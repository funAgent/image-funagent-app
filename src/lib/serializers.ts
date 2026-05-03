import type { Generation, User } from "@/generated/prisma/client";

export function publicUser(user: User) {
  return {
    id: user.id,
    wechatOpenId: maskOpenId(user.wechatOpenId),
    role: user.role,
    status: user.status,
    dailyLimitOverride: user.dailyLimitOverride,
    maxRefImagesOverride: user.maxRefImagesOverride,
    maxFileMbOverride: user.maxFileMbOverride,
    createdAt: user.createdAt.toISOString(),
  };
}

export function publicGeneration(generation: Generation) {
  return {
    id: generation.id,
    status: generation.status,
    mode: generation.mode,
    model: generation.model,
    prompt: generation.prompt,
    size: generation.size,
    quality: generation.quality,
    outputFormat: generation.outputFormat,
    imageUrl: generation.imageUrl,
    errorMessage: generation.errorMessage,
    referenceImages: generation.referenceImages,
    inputTokens: generation.inputTokens,
    outputTokens: generation.outputTokens,
    createdAt: generation.createdAt.toISOString(),
    completedAt: generation.completedAt?.toISOString() ?? null,
  };
}

function maskOpenId(openid?: string | null) {
  if (!openid) return null;
  if (openid.length <= 10) return openid;
  return `${openid.slice(0, 6)}...${openid.slice(-4)}`;
}
