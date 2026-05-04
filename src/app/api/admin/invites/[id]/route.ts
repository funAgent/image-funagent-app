import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { publicInvite } from "@/lib/invites";

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
    await requireAdmin();
    const { id } = await context.params;
    const payload = updateInviteSchema.parse(await request.json());

    const invite = await prisma.inviteCode.findUnique({ where: { id } });
    if (!invite) {
      throw new ApiError("NOT_FOUND", "邀请码不存在。", 404);
    }

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

    return jsonOk({ invite: publicInvite(updated) });
  } catch (error) {
    return jsonError(error);
  }
}
