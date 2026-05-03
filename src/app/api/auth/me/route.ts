import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { getQuota } from "@/lib/quota";
import { publicGeneration, publicUser } from "@/lib/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonOk({ user: null, quota: null, generations: [] });
    }

    const [quota, generations] = await Promise.all([
      getQuota(user),
      prisma.generation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    ]);

    return jsonOk({
      user: publicUser(user),
      quota,
      generations: generations.map(publicGeneration),
    });
  } catch (error) {
    return jsonError(error);
  }
}
