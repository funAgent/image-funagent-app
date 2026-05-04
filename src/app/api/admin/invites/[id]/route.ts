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
import { publicInvite } from "@/lib/invites";
import { RATE_LIMITS, rateLimitByUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

const updateInviteSchema = z.object({
  disabled: z.boolean().optional(),
  dailyLimitOverride: z.number().int().positive().nullable().optional(),
  maxRefImagesOverride: z.number().int().positive().nullable().optional(),
  maxFileMbOverride: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/invites/[id]">,
) {
  try {
    const admin = await requireAdmin();
    await rateLimitByUser(RATE_LIMITS.admin);
    const { id } = await context.params;
    const payload = updateInviteSchema.parse(await request.json());

    const invite = await prisma.inviteCode.findUnique({ where: { id } });
    if (!invite) {
      throw new ApiError("NOT_FOUND", "邀请码不存在。", 404);
    }

    const beforeQuota = quotaSnapshot(invite);

    const updated = await prisma.inviteCode.update({
      where: { id },
      data: {
        disabledAt:
          payload.disabled === undefined
            ? undefined
            : payload.disabled
              ? new Date()
              : null,
        ...(payload.dailyLimitOverride !== undefined
          ? { dailyLimitOverride: payload.dailyLimitOverride }
          : {}),
        ...(payload.maxRefImagesOverride !== undefined
          ? { maxRefImagesOverride: payload.maxRefImagesOverride }
          : {}),
        ...(payload.maxFileMbOverride !== undefined
          ? { maxFileMbOverride: payload.maxFileMbOverride }
          : {}),
      },
    });

    if (payload.disabled !== undefined && Boolean(invite.disabledAt) !== Boolean(updated.disabledAt)) {
      await createAdminAuditLog({
        action: "INVITE_STATUS_CHANGED",
        actorUserId: admin.id,
        targetInviteId: updated.id,
        summary: `${updated.disabledAt ? "停用" : "启用"}邀请码 ${updated.codePreview}`,
        metadata: {
          inviteId: updated.id,
          codePreview: updated.codePreview,
          label: updated.label,
          before: { disabled: Boolean(invite.disabledAt) },
          after: { disabled: Boolean(updated.disabledAt) },
        },
      });
    }

    const afterQuota = quotaSnapshot(updated);
    const changes = quotaChanges(beforeQuota, afterQuota);
    if (hasQuotaChanges(changes)) {
      await createAdminAuditLog({
        action: "INVITE_QUOTA_CHANGED",
        actorUserId: admin.id,
        targetInviteId: updated.id,
        summary: `修改邀请码额度 ${updated.codePreview}`,
        metadata: {
          inviteId: updated.id,
          codePreview: updated.codePreview,
          label: updated.label,
          changes,
        },
      });
    }

    return jsonOk({ invite: publicInvite(updated) });
  } catch (error) {
    return jsonError(error);
  }
}
