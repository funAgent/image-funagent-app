import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { RATE_LIMITS, rateLimitByUser } from "@/lib/rate-limit";
import { publicGeneration } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/users/[id]/generations">,
) {
  try {
    await requireAdmin();
    await rateLimitByUser(RATE_LIMITS.admin);
    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        wechatOpenId: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new ApiError("NOT_FOUND", "用户不存在。", 404);
    }

    const generations = await prisma.generation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return jsonOk({
      user,
      generations: generations.map(publicGeneration),
    });
  } catch (error) {
    return jsonError(error);
  }
}
