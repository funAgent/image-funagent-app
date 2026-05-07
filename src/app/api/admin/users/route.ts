import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { todayInShanghai } from "@/lib/quota";
import { RATE_LIMITS, rateLimitByUser } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    await rateLimitByUser(RATE_LIMITS.admin);
    const usageDate = todayInShanghai();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        dailyUsage: {
          where: { usageDate },
          take: 1,
        },
        _count: {
          select: { generations: true },
        },
        inviteCode: {
          select: {
            codePreview: true,
            label: true,
            createdAt: true,
          },
        },
      },
    });

    return jsonOk({
      users: users.map((user) => ({
        id: user.id,
        wechatOpenId: user.wechatOpenId,
        role: user.role,
        status: user.status,
        dailyLimitOverride: user.dailyLimitOverride,
        maxRefImagesOverride: user.maxRefImagesOverride,
        maxFileMbOverride: user.maxFileMbOverride,
        createdAt: user.createdAt.toISOString(),
        todayUsed: user.dailyUsage[0]?.usedCount ?? 0,
        todayReserved: user.dailyUsage[0]?.reservedCount ?? 0,
        generationsCount: user._count.generations,
        inviteCode: user.inviteCode
          ? {
              codePreview: user.inviteCode.codePreview,
              label: user.inviteCode.label,
              createdAt: user.inviteCode.createdAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
