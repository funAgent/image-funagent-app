import OpenAI, { toFile } from "openai";
import { put } from "@vercel/blob";
import { appEnv } from "@/lib/env";
import { ApiError } from "@/lib/http";
import type { ValidatedUpload } from "@/lib/uploads";

export const imageSizes = ["auto", "1024x1024", "1024x1536", "1536x1024"] as const;
export const imageAspectPresets = ["auto", "1:1", "3:4", "4:3", "16:9", "9:16"] as const;
export const imageQualities = ["low", "medium", "high"] as const;
export const outputFormats = ["png", "jpeg", "webp"] as const;

export type ImageSize = (typeof imageSizes)[number];
export type ImageAspectPreset = (typeof imageAspectPresets)[number];
export type ImageQuality = (typeof imageQualities)[number];
export type OutputFormat = (typeof outputFormats)[number];

let client: OpenAI | null = null;
let clientKey: string | null = null;
let clientBaseUrl: string | null = null;

const getOpenAI = () => {
  const apiKey = process.env.XAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.XAI_BASE_URL;

  if (!apiKey) {
    throw new ApiError("CONFIG_MISSING", "图片生成 API Key 未配置。", 500);
  }

  if (!client || clientKey !== apiKey || clientBaseUrl !== (baseURL ?? null)) {
    client = new OpenAI({
      apiKey,
      baseURL,
    });
    clientKey = apiKey;
    clientBaseUrl = baseURL ?? null;
  }

  return client;
};

export function isImageSize(value: string): value is ImageSize {
  return imageSizes.includes(value as ImageSize);
}

export function isImageAspectPreset(value: string): value is ImageAspectPreset {
  return imageAspectPresets.includes(value as ImageAspectPreset);
}

export function resolveImageAspect(value: ImageAspectPreset | ImageSize): {
  size: ImageSize;
  promptHint: string | null;
} {
  switch (value) {
    case "auto":
      return { size: "auto", promptHint: null };
    case "1:1":
    case "1024x1024":
      return {
        size: "1024x1024",
        promptHint: "请采用 1:1 正方形构图，主体适配正方画面。",
      };
    case "3:4":
      return {
        size: "1024x1536",
        promptHint: "请采用 3:4 竖版构图，主体适配该比例。",
      };
    case "9:16":
      return {
        size: "1024x1536",
        promptHint: "请采用 9:16 手机竖屏构图，主体适配竖屏画面。",
      };
    case "4:3":
      return {
        size: "1536x1024",
        promptHint: "请采用 4:3 横版构图，主体适配该比例。",
      };
    case "16:9":
      return {
        size: "1536x1024",
        promptHint: "请采用 16:9 宽屏横版构图，主体适配宽屏画面。",
      };
    case "1024x1536":
      return {
        size: "1024x1536",
        promptHint: "请采用竖版构图，主体适配竖向画面。",
      };
    case "1536x1024":
      return {
        size: "1536x1024",
        promptHint: "请采用横版构图，主体适配横向画面。",
      };
  }
}

export function isImageQuality(value: string): value is ImageQuality {
  return imageQualities.includes(value as ImageQuality);
}

export function isOutputFormat(value: string): value is OutputFormat {
  return outputFormats.includes(value as OutputFormat);
}

function asOpenAIError(error: unknown): ApiError {
  const errorText = collectErrorText(error);
  const normalizedErrorText = errorText.toLowerCase();
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;

  console.error("[openai:image]", {
    status,
    code,
    message: errorText.slice(0, 800),
  });

  if (status === 401 || status === 403) {
    return new ApiError(
      "CONFIG_MISSING",
      "OpenAI API Key 无效或没有图片模型权限，请检查环境变量。",
      500,
    );
  }

  if (status === 429) {
    return new ApiError(
      "UPSTREAM_ERROR",
      "OpenAI 请求过于频繁或额度不足，请稍后再试。",
      502,
    );
  }

  if (status === 400) {
    if (
      normalizedErrorText.includes("billing") ||
      normalizedErrorText.includes("hard limit") ||
      normalizedErrorText.includes("quota")
    ) {
      return new ApiError(
        "UPSTREAM_ERROR",
        "OpenAI 账单额度或硬上限已用完，请调整 OpenAI Billing 设置后重试。",
        502,
      );
    }

    if (
      normalizedErrorText.includes("safety") ||
      normalizedErrorText.includes("moderation") ||
      normalizedErrorText.includes("content policy")
    ) {
      return new ApiError(
        "UPSTREAM_ERROR",
        "OpenAI 安全策略拒绝了这次图片生成，请调整描述后重试。",
        502,
      );
    }

    if (normalizedErrorText.includes("model")) {
      return new ApiError(
        "CONFIG_MISSING",
        "OpenAI 图片模型配置不支持，请检查 OPENAI_IMAGE_MODEL。",
        500,
      );
    }

    return new ApiError(
      "UPSTREAM_ERROR",
      `OpenAI 拒绝了这次请求：${cleanProviderMessage(errorText)}`,
      502,
    );
  }

  if (
    code === "ETIMEDOUT" ||
    errorText.includes("Connection error") ||
    errorText.includes("fetch failed") ||
    errorText.includes("ETIMEDOUT") ||
    normalizedErrorText.includes("timeout") ||
    normalizedErrorText.includes("timed out") ||
    normalizedErrorText.includes("couldn't connect")
  ) {
    return new ApiError(
      "UPSTREAM_ERROR",
      "OpenAI 连接失败，请检查网络后重试。",
      502,
    );
  }

  return new ApiError("UPSTREAM_ERROR", "图片生成服务暂时不可用，请稍后再试。", 502);
}

function cleanProviderMessage(message: string) {
  return message
    .replace(/\s+/g, " ")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer ***")
    .trim()
    .slice(0, 220);
}

function collectErrorText(error: unknown, depth = 0): string {
  if (!error || depth > 4) return "";
  if (error instanceof Error) {
    const cause = "cause" in error ? collectErrorText(error.cause, depth + 1) : "";
    return `${error.name} ${error.message} ${cause}`;
  }
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const ownText = Object.entries(record)
      .filter(([key]) => ["message", "code", "type"].includes(key))
      .map(([, value]) => String(value))
      .join(" ");
    return `${ownText} ${collectErrorText(record.cause, depth + 1)}`;
  }
  return String(error);
}

export async function createImageWithOpenAI(input: {
  prompt: string;
  files: ValidatedUpload[];
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: OutputFormat;
  userId: string;
}) {
  const openai = getOpenAI();

  const common = {
    model: appEnv.openaiImageModel,
    prompt: input.prompt,
    n: 1,
    size: input.size,
    quality: input.quality,
    output_format: input.outputFormat,
    user: input.userId,
  } as const;

  const response = await (async () => {
    try {
      return input.files.length > 0
        ? await openai.images.edit({
            ...common,
            image: await Promise.all(
              input.files.map(async (upload) =>
                toFile(
                  Buffer.from(await upload.file.arrayBuffer()),
                  upload.name,
                  { type: upload.type },
                ),
              ),
            ),
          })
        : await openai.images.generate({
            ...common,
            moderation: "auto",
          });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw asOpenAIError(error);
    }
  })();

  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw new ApiError("UPSTREAM_ERROR", "OpenAI 没有返回图片。", 502);
  }

  return {
    b64Json: image.b64_json,
    revisedPrompt: image.revised_prompt,
    usage: response.usage,
  };
}

export async function storeGeneratedImage(input: {
  generationId: string;
  b64Json: string;
  outputFormat: OutputFormat;
}) {
  const contentType = `image/${input.outputFormat === "jpeg" ? "jpeg" : input.outputFormat}`;
  const bytes = Buffer.from(input.b64Json, "base64");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError("CONFIG_MISSING", "Vercel Blob Token 未配置。", 500);
    }

    return {
      url: `data:${contentType};base64,${input.b64Json}`,
      key: null,
    };
  }

  const blob = await put(
    `generations/${new Date().toISOString().slice(0, 10)}/${input.generationId}.${input.outputFormat}`,
    bytes,
    {
      access: "public",
      addRandomSuffix: true,
      contentType,
    },
  );

  return {
    url: blob.url,
    key: blob.pathname,
  };
}

export async function storeReferenceImages(input: {
  generationId: string;
  files: ValidatedUpload[];
}) {
  if (input.files.length === 0) return [];

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ApiError("CONFIG_MISSING", "参考图存储 Token 未配置。", 500);
  }

  return Promise.all(
    input.files.map(async (upload, index) => {
      const extension = upload.type === "image/jpeg"
        ? "jpg"
        : upload.type === "image/webp"
          ? "webp"
          : "png";
      const blob = await put(
        `references/${input.generationId}/${index + 1}-${upload.name}.${extension}`,
        Buffer.from(await upload.file.arrayBuffer()),
        {
          access: "public",
          addRandomSuffix: true,
          contentType: upload.type,
        },
      );

      return {
        name: upload.name,
        size: upload.size,
        type: upload.type,
        url: blob.url,
        key: blob.pathname,
      };
    }),
  );
}
