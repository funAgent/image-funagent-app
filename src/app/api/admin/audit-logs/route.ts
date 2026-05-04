import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();

    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actorUser: {
          select: {
            id: true,
            wechatOpenId: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            wechatOpenId: true,
            role: true,
            status: true,
          },
        },
        targetInvite: {
          select: {
            id: true,
            codePreview: true,
            label: true,
            role: true,
          },
        },
      },
    });

    return jsonOk({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        summary: log.summary,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
        actorUser: log.actorUser,
        targetUser: log.targetUser,
        targetInvite: log.targetInvite,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
