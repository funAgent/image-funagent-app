import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";

type GenerationRow = {
  id: string;
  userId: string;
  usageDate: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  outputFormat: "png" | "jpeg" | "webp";
  referenceImages: unknown;
};

type ReferenceImage = {
  name: string;
  type: "image/png" | "image/jpeg" | "image/webp";
  url: string;
};

type ImageResult = {
  b64Json: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type ProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  keySource?: string;
};

const workerLockId = 294781604;
const bucket = "generation-images";
const xaiDefaultBaseUrl = "https://api-xai.ainaibahub.com/v1";
const corsHeaders = {
  "access-control-allow-origin": "https://image.funagent.app",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorized(request)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const body = await readJson(request);
  const limit = clampNumber(body?.limit, 1, 3, 1);
  const provider = parseProviderConfig(body?.provider);

  EdgeRuntime.waitUntil(processQueue(limit, provider));

  return json({ ok: true, accepted: true });
});

async function processQueue(limit: number, provider?: ProviderConfig | null) {
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL");
  if (!databaseUrl) {
    console.error("[worker] DATABASE_URL is not configured");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  let locked = false;

  try {
    const lockRows = await sql<{ locked: boolean }[]>`
      select pg_try_advisory_lock(${workerLockId}) as locked
    `;
    locked = lockRows[0]?.locked === true;
    if (!locked) return;

    for (let index = 0; index < limit; index += 1) {
      const generation = await nextQueuedGeneration(sql);
      if (!generation) break;
      await processGeneration(sql, generation, provider);
    }
  } catch (error) {
    console.error("[worker] queue failed", toProviderMessage(error));
  } finally {
    if (locked) {
      await sql`select pg_advisory_unlock(${workerLockId})`.catch(console.error);
    }
    await sql.end({ timeout: 5 }).catch(console.error);
  }
}

async function nextQueuedGeneration(sql: postgres.Sql) {
  const rows = await sql<GenerationRow[]>`
    select
      id,
      "userId",
      "usageDate",
      model,
      prompt,
      size,
      quality,
      "outputFormat",
      "referenceImages"
    from "Generation"
    where status = 'QUEUED'
    order by "createdAt" asc
    limit 1
  `;

  return rows[0] ?? null;
}

async function processGeneration(
  sql: postgres.Sql,
  generation: GenerationRow,
  provider?: ProviderConfig | null,
) {
  try {
    const image = await createImage(generation, provider);
    const stored = await storeImage(generation, image.b64Json);

    await sql.begin(async (tx) => {
      const updated = await tx<{ id: string }[]>`
        update "Generation"
        set
          status = 'SUCCEEDED',
          "imageUrl" = ${stored.url},
          "storageKey" = ${stored.path},
          "inputTokens" = ${image.usage?.input_tokens ?? null},
          "outputTokens" = ${image.usage?.output_tokens ?? null},
          "completedAt" = now()
        where id = ${generation.id}
          and status = 'QUEUED'
        returning id
      `;

      if (updated.length === 0) return;

      await tx`
        update "DailyUsage"
        set
          "reservedCount" = greatest("reservedCount" - 1, 0),
          "usedCount" = "usedCount" + 1,
          "totalInputTokens" = "totalInputTokens" + ${image.usage?.input_tokens ?? 0},
          "totalOutputTokens" = "totalOutputTokens" + ${image.usage?.output_tokens ?? 0},
          "updatedAt" = now()
        where "userId" = ${generation.userId}
          and "usageDate" = ${generation.usageDate}
      `;
    });
  } catch (error) {
    const message = toUserMessage(error);
    console.error("[worker] generation failed", {
      generationId: generation.id,
      message,
      detail: toProviderMessage(error),
    });

    await sql.begin(async (tx) => {
      const updated = await tx<{ id: string }[]>`
        update "Generation"
        set
          status = 'FAILED',
          "errorMessage" = ${message},
          "completedAt" = now()
        where id = ${generation.id}
          and status = 'QUEUED'
        returning id
      `;

      if (updated.length === 0) return;

      await tx`
        update "DailyUsage"
        set
          "reservedCount" = greatest("reservedCount" - 1, 0),
          "updatedAt" = now()
        where "userId" = ${generation.userId}
          and "usageDate" = ${generation.usageDate}
      `;
    });
  }
}

async function createImage(
  generation: GenerationRow,
  provider?: ProviderConfig | null,
): Promise<ImageResult> {
  const xaiKey = envValue("XAI_API_KEY");
  const openaiKey = envValue("OPENAI_API_KEY");
  const providerApiKey = cleanString(provider?.apiKey);
  const apiKey = providerApiKey ?? xaiKey ?? openaiKey;
  const baseUrl = normalizeBaseUrl(
    providerApiKey
      ? cleanString(provider?.baseUrl) ?? xaiDefaultBaseUrl
      : xaiKey
        ? envValue("OPENAI_BASE_URL") ?? envValue("XAI_BASE_URL") ?? xaiDefaultBaseUrl
      : envValue("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
  );
  const model = cleanString(provider?.model) ?? envValue("OPENAI_IMAGE_MODEL") ?? generation.model;
  const resolved = resolveImageAspect(generation.size);
  const prompt = resolved.promptHint
    ? `${generation.prompt}\n\n画幅要求：${resolved.promptHint}`
    : generation.prompt;

  if (!apiKey) {
    throw new Error("图片生成 API Key 未配置。");
  }

  console.info("[worker] image provider", {
    generationId: generation.id,
    baseUrl,
    model,
    keySource: cleanString(provider?.keySource) ?? (xaiKey ? "XAI_API_KEY" : "OPENAI_API_KEY"),
  });

  const references = parseReferences(generation.referenceImages);
  const endpoint = references.length > 0 ? "images/edits" : "images/generations";
  const response = references.length > 0
    ? await createImageEdit({ apiKey, baseUrl, endpoint, model, prompt, generation, references, size: resolved.size })
    : await createImageGeneration({ apiKey, baseUrl, endpoint, model, prompt, generation, size: resolved.size });

  if (!response.ok) {
    throw new Error(await providerErrorText(response));
  }

  const data = await response.json();
  const b64Json = data?.data?.[0]?.b64_json;
  if (!b64Json) {
    throw new Error("图片生成服务没有返回图片。");
  }

  return {
    b64Json,
    usage: data?.usage,
  };
}

async function createImageGeneration(input: {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  model: string;
  prompt: string;
  generation: GenerationRow;
  size: string;
}) {
  return fetch(`${input.baseUrl}/${input.endpoint}`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      n: 1,
      size: input.size,
      quality: input.generation.quality,
      output_format: input.generation.outputFormat,
      moderation: "auto",
      user: input.generation.userId,
    }),
  });
}

async function createImageEdit(input: {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  model: string;
  prompt: string;
  generation: GenerationRow;
  references: ReferenceImage[];
  size: string;
}) {
  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.prompt);
  form.set("n", "1");
  form.set("size", input.size);
  form.set("quality", input.generation.quality);
  form.set("output_format", input.generation.outputFormat);
  form.set("user", input.generation.userId);

  for (const reference of input.references) {
    const response = await fetch(reference.url);
    if (!response.ok) {
      throw new Error("参考图读取失败，请重新上传后再试。");
    }
    const blob = await response.blob();
    form.append("image[]", blob, reference.name);
  }

  return fetch(`${input.baseUrl}/${input.endpoint}`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${input.apiKey}`,
    },
    body: form,
  });
}

async function storeImage(generation: GenerationRow, b64Json: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage 配置缺失。");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const contentType = `image/${generation.outputFormat === "jpeg" ? "jpeg" : generation.outputFormat}`;
  const bytes = decodeBase64(b64Json);
  const path = `${new Date().toISOString().slice(0, 10)}/${generation.id}.${generation.outputFormat}`;

  let { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error && error.message.toLowerCase().includes("bucket")) {
    const { error: bucketError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });

    if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
      throw new Error(`图片存储桶创建失败：${bucketError.message}`);
    }

    const retry = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    error = retry.error;
  }

  if (error) {
    throw new Error(`图片存储失败：${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    url: data.publicUrl,
  };
}

function parseReferences(value: unknown): ReferenceImage[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is ReferenceImage => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.url === "string" &&
      typeof record.name === "string" &&
      ["image/png", "image/jpeg", "image/webp"].includes(String(record.type))
    );
  });
}

function resolveImageAspect(value: string) {
  switch (value) {
    case "1:1":
    case "1024x1024":
      return {
        size: "1024x1024",
        promptHint: "请采用 1:1 正方形构图，主体适配正方画面。",
      };
    case "3:4":
    case "1024x1536":
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
    case "1536x1024":
      return {
        size: "1536x1024",
        promptHint: "请采用 4:3 横版构图，主体适配该比例。",
      };
    case "16:9":
      return {
        size: "1536x1024",
        promptHint: "请采用 16:9 宽屏横版构图，主体适配宽屏画面。",
      };
    default:
      return {
        size: "auto",
        promptHint: null,
      };
  }
}

function isAuthorized(request: Request) {
  const secret = Deno.env.get("PROCESS_GENERATION_SECRET");
  if (!secret) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const workerSecret = request.headers.get("x-worker-secret") ?? "";
  return authorization === `Bearer ${secret}` || workerSecret === secret;
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseProviderConfig(value: unknown): ProviderConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    apiKey: typeof record.apiKey === "string" ? record.apiKey : undefined,
    baseUrl: typeof record.baseUrl === "string" ? record.baseUrl : undefined,
    model: typeof record.model === "string" ? record.model : undefined,
    keySource: typeof record.keySource === "string" ? record.keySource : undefined,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function envValue(name: string) {
  return cleanString(Deno.env.get(name));
}

function cleanString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function providerErrorText(response: Response) {
  const text = await response.text();
  return `Provider ${response.status}: ${text.slice(0, 1200)}`;
}

function toUserMessage(error: unknown) {
  const message = toProviderMessage(error).toLowerCase();

  if (message.includes("billing") || message.includes("quota") || message.includes("hard limit")) {
    return "图片生成额度不足，请检查模型平台余额或账单上限。";
  }

  if (message.includes("safety") || message.includes("moderation") || message.includes("content policy")) {
    return "安全策略拒绝了这次图片生成，请调整描述后重试。";
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return "图片生成超时，请稍后重试或简化提示词。";
  }

  if (message.includes("api key") || message.includes("unauthorized") || message.includes("401") || message.includes("403")) {
    return "图片生成服务鉴权失败，请检查服务配置。";
  }

  return error instanceof Error ? error.message.slice(0, 220) : "图片生成失败。";
}

function toProviderMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}
