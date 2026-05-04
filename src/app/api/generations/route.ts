import { type NextRequest } from "next/server";
import { after } from "next/server";
import {
  createImageWithOpenAI,
  isImageAspectPreset,
  isImageQuality,
  isImageSize,
  isOutputFormat,
  resolveImageAspect,
  storeGeneratedImage,
  type ImageQuality,
  type ImageSize,
  type OutputFormat,
} from "@/lib/openai-images";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { finalizeGenerationUsage, getQuota, reserveGeneration } from "@/lib/quota";
import { publicGeneration } from "@/lib/serializers";
import { getFiles, validateUploads, type ValidatedUpload } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await requireUser();
    const [quota, generations] = await Promise.all([
      getQuota(user),
      prisma.generation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    ]);

    return jsonOk({
      quota,
      generations: generations.map(publicGeneration),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  let usageDate: Date | null = null;
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const formData = await request.formData();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const sizeRaw = String(formData.get("size") ?? "auto");
    const qualityRaw = String(formData.get("quality") ?? "medium");
    const outputFormatRaw = String(formData.get("outputFormat") ?? "png");

    if (prompt.length < 2) {
      throw new ApiError("BAD_REQUEST", "请补充图片描述。", 400);
    }

    if (prompt.length > 1200) {
      throw new ApiError("BAD_REQUEST", "图片描述最多 1200 字。", 400);
    }

    if (
      (!isImageAspectPreset(sizeRaw) && !isImageSize(sizeRaw)) ||
      !isImageQuality(qualityRaw) ||
      !isOutputFormat(outputFormatRaw)
    ) {
      throw new ApiError("BAD_REQUEST", "图片参数不合法。", 400);
    }

    const resolvedAspect = resolveImageAspect(sizeRaw);
    const promptForOpenAI = resolvedAspect.promptHint
      ? `${prompt}\n\n画幅要求：${resolvedAspect.promptHint}`
      : prompt;
    const uploads = validateUploads(getFiles(formData), user);
    const reservation = await reserveGeneration(user);
    usageDate = reservation.usageDate;

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        mode: uploads.length > 0 ? "REFERENCE" : "TEXT",
        model: appEnv.openaiImageModel,
        prompt,
        size: sizeRaw,
        quality: qualityRaw,
        outputFormat: outputFormatRaw,
        usageDate,
        referenceImages:
          uploads.length > 0
            ? uploads.map((upload) => ({
                name: upload.name,
                size: upload.size,
                type: upload.type,
              }))
            : undefined,
      },
    });

    after(() =>
      processGeneration({
        generationId: generation.id,
        userId: user.id,
        usageDate: reservation.usageDate,
        prompt: promptForOpenAI,
        files: uploads,
        size: resolvedAspect.size,
        quality: qualityRaw,
        outputFormat: outputFormatRaw,
      }),
    );

    return jsonOk({
      generation: publicGeneration(generation),
      quota: await getQuota(user),
    });
  } catch (error) {
    if (usageDate && userId) {
      await finalizeGenerationUsage(userId, usageDate, false).catch(console.error);
    }

    return jsonError(error);
  }
}

async function processGeneration(input: {
  generationId: string;
  userId: string;
  usageDate: Date;
  prompt: string;
  files: ValidatedUpload[];
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: OutputFormat;
}) {
  try {
    const created = await createImageWithOpenAI({
      prompt: input.prompt,
      files: input.files,
      size: input.size,
      quality: input.quality,
      outputFormat: input.outputFormat,
      userId: input.userId,
    });

    const stored = await storeGeneratedImage({
      generationId: input.generationId,
      b64Json: created.b64Json,
      outputFormat: input.outputFormat,
    });

    await prisma.generation.update({
      where: { id: input.generationId },
      data: {
        status: "SUCCEEDED",
        imageUrl: stored.url,
        storageKey: stored.key,
        inputTokens: created.usage?.input_tokens,
        outputTokens: created.usage?.output_tokens,
        completedAt: new Date(),
      },
    });

    await finalizeGenerationUsage(
      input.userId,
      input.usageDate,
      true,
      created.usage?.input_tokens,
      created.usage?.output_tokens,
    );
  } catch (error) {
    await finalizeGenerationUsage(input.userId, input.usageDate, false).catch(
      console.error,
    );

    await prisma.generation
      .update({
        where: { id: input.generationId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "图片生成失败。",
          completedAt: new Date(),
        },
      })
      .catch(console.error);
  }
}
