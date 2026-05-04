import { type NextRequest } from "next/server";
import { after } from "next/server";
import {
  isImageAspectPreset,
  isImageQuality,
  isImageSize,
  isOutputFormat,
  storeReferenceImages,
} from "@/lib/openai-images";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { finalizeGenerationUsage, getQuota, reserveGeneration } from "@/lib/quota";
import { publicGeneration } from "@/lib/serializers";
import { getFiles, validateUploads } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const staleQueuedAfterMs = 2 * 60 * 60 * 1000;

export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleQueuedGenerations(user.id);

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
  let generationId: string | null = null;

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

    if (prompt.length > 3200) {
      throw new ApiError("BAD_REQUEST", "图片描述最多 3200 字。", 400);
    }

    if (
      (!isImageAspectPreset(sizeRaw) && !isImageSize(sizeRaw)) ||
      !isImageQuality(qualityRaw) ||
      !isOutputFormat(outputFormatRaw)
    ) {
      throw new ApiError("BAD_REQUEST", "图片参数不合法。", 400);
    }

    const uploads = validateUploads(getFiles(formData), user);
    const reservation = await reserveGeneration(user);
    usageDate = reservation.usageDate;

    let generation = await prisma.generation.create({
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
    generationId = generation.id;

    const references = await storeReferenceImages({
      generationId: generation.id,
      files: uploads,
    });

    if (references.length > 0) {
      generation = await prisma.generation.update({
        where: { id: generation.id },
        data: { referenceImages: references },
      });
    }

    after(() => triggerGenerationWorker().catch(console.error));

    return jsonOk({
      generation: publicGeneration(generation),
      quota: await getQuota(user),
    });
  } catch (error) {
    if (generationId) {
      await prisma.generation
        .update({
          where: { id: generationId },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "生成任务创建失败。",
            completedAt: new Date(),
          },
        })
        .catch(console.error);
    }

    if (usageDate && userId) {
      await finalizeGenerationUsage(userId, usageDate, false).catch(console.error);
    }

    return jsonError(error);
  }
}

async function triggerGenerationWorker() {
  const functionUrl =
    process.env.PROCESS_GENERATION_FUNCTION_URL ??
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/process-generation`
      : null);
  const secret = process.env.PROCESS_GENERATION_SECRET;

  if (!functionUrl || !secret) {
    console.warn("[generation-worker] Supabase Edge Function trigger is not configured");
    return;
  }

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${secret}`,
      "content-type": "application/json",
      "x-worker-secret": secret,
    },
    body: JSON.stringify({ source: "vercel" }),
  });

  if (!response.ok) {
    console.error("[generation-worker] trigger failed", response.status, await response.text());
  }
}

async function expireStaleQueuedGenerations(userId: string) {
  const staleBefore = new Date(Date.now() - staleQueuedAfterMs);
  const staleGenerations = await prisma.generation.findMany({
    where: {
      userId,
      status: "QUEUED",
      createdAt: { lt: staleBefore },
    },
    select: {
      id: true,
      usageDate: true,
    },
  });

  if (staleGenerations.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const generation of staleGenerations) {
      await tx.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: "生成任务超时，额度已退回，请重新生成。",
          completedAt: new Date(),
        },
      });

      await tx.dailyUsage.updateMany({
        where: {
          userId,
          usageDate: generation.usageDate,
          reservedCount: { gt: 0 },
        },
        data: {
          reservedCount: { decrement: 1 },
        },
      });
    }
  });
}
