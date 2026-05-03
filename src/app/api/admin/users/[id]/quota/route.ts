import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";

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
    await requireAdmin();
    const { id } = await context.params;
    const payload = quotaSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError("NOT_FOUND", "用户不存在。", 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: payload,
    });

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
