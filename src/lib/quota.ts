import { Prisma } from "@/generated/prisma/client";
import { appEnv } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export function todayInShanghai() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

export function userLimits(user: Pick<User, "dailyLimitOverride" | "maxRefImagesOverride" | "maxFileMbOverride">) {
  return {
    dailyLimit: user.dailyLimitOverride ?? appEnv.defaultDailyLimit,
    maxRefImages: user.maxRefImagesOverride ?? appEnv.defaultMaxRefImages,
    maxFileMb: user.maxFileMbOverride ?? appEnv.defaultMaxFileMb,
    maxTotalUploadMb: appEnv.maxTotalUploadMb,
  };
}

export async function getQuota(user: User) {
  const limits = userLimits(user);
  const usageDate = todayInShanghai();
  const usage = await prisma.dailyUsage.findUnique({
    where: {
      userId_usageDate: {
        userId: user.id,
        usageDate,
      },
    },
  });

  const used = usage?.usedCount ?? 0;
  const reserved = usage?.reservedCount ?? 0;

  return {
    ...limits,
    usageDate: usageDate.toISOString().slice(0, 10),
    used,
    reserved,
    remaining: Math.max(0, limits.dailyLimit - used - reserved),
  };
}

export async function reserveGeneration(user: User) {
  const limits = userLimits(user);
  const usageDate = todayInShanghai();

  await prisma.$transaction(
    async (tx) => {
      const usage = await tx.dailyUsage.upsert({
        where: {
          userId_usageDate: {
            userId: user.id,
            usageDate,
          },
        },
        create: {
          userId: user.id,
          usageDate,
          reservedCount: 0,
          usedCount: 0,
        },
        update: {},
      });

      if (usage.usedCount + usage.reservedCount >= limits.dailyLimit) {
        throw new ApiError("QUOTA_EXCEEDED", "今天的免费次数已经用完。", 429);
      }

      await tx.dailyUsage.update({
        where: { id: usage.id },
        data: { reservedCount: { increment: 1 } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return { usageDate };
}

export async function finalizeGenerationUsage(
  userId: string,
  usageDate: Date,
  succeeded: boolean,
  inputTokens?: number,
  outputTokens?: number,
) {
  await prisma.dailyUsage.update({
    where: {
      userId_usageDate: {
        userId,
        usageDate,
      },
    },
    data: {
      reservedCount: { decrement: 1 },
      usedCount: succeeded ? { increment: 1 } : undefined,
      totalInputTokens: inputTokens ? { increment: inputTokens } : undefined,
      totalOutputTokens: outputTokens ? { increment: outputTokens } : undefined,
    },
  });
}
