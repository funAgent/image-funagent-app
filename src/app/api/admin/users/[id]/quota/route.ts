import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  createAdminAuditLog,
  hasQuotaChanges,
  quotaChanges,
  quotaSnapshot,
} from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { RATE_LIMITS, rateLimitByUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

const quotaSchema = z.object({
  dailyLimitOverride: z.number().int().min(0).max(1000).nullable().optional(),
  maxRefImagesOverride: z.number().int().min(1).max(16).nullable().optional(),
  maxFileMbOverride: z.number().int().min(1).max(50).nullable().optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/users/[id]/quota">,
) {
  try {
    const admin = await requireAdmin();
    await rateLimitByUser(RATE_LIMITS.admin);
    const { id } = await context.params;
    const payload = quotaSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError("NOT_FOUND", "用户不存在。", 404);
    }

    const beforeQuota = quotaSnapshot(user);
    const previousStatus = user.status;
    const previousRole = user.role;

    const updated = await prisma.user.update({
      where: { id },
      data: payload,
    });

    if (payload.status !== undefined && previousStatus !== updated.status) {
      await createAdminAuditLog({
        action: "USER_STATUS_CHANGED",
        actorUserId: admin.id,
        targetUserId: updated.id,
        summary: `将用户 ${updated.id} ${updated.status === "BLOCKED" ? "停用" : "启用"}`,
        metadata: {
          userId: updated.id,
          before: { status: previousStatus },
          after: { status: updated.status },
        },
      });
    }

    if (payload.role !== undefined && previousRole !== updated.role) {
      await createAdminAuditLog({
        action: "USER_ROLE_CHANGED",
        actorUserId: admin.id,
        targetUserId: updated.id,
        summary: `将用户 ${updated.id} 角色改为 ${updated.role}`,
        metadata: {
          userId: updated.id,
          before: { role: previousRole },
          after: { role: updated.role },
        },
      });
    }

    const afterQuota = quotaSnapshot(updated);
    const changes = quotaChanges(beforeQuota, afterQuota);
    if (hasQuotaChanges(changes)) {
      await createAdminAuditLog({
        action: "USER_QUOTA_CHANGED",
        actorUserId: admin.id,
        targetUserId: updated.id,
        summary: `修改用户 ${updated.id} 的额度`,
        metadata: {
          userId: updated.id,
          changes,
        },
      });
    }

    return jsonOk({
      user: {
        id: updated.id,
        role: updated.role,
        status: updated.status,
        dailyLimitOverride: updated.dailyLimitOverride,
        maxRefImagesOverride: updated.maxRefImagesOverride,
        maxFileMbOverride: updated.maxFileMbOverride,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
