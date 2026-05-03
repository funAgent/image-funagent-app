import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { createInvite, publicInvite } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  label: z.string().max(80).nullable().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  dailyLimitOverride: z.number().int().min(0).max(1000).nullable().optional(),
  maxRefImagesOverride: z.number().int().min(1).max(16).nullable().optional(),
  maxFileMbOverride: z.number().int().min(1).max(50).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const invites = await prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return jsonOk({ invites: invites.map(publicInvite) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const payload = inviteSchema.parse(await request.json());
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;

    if (expiresAt && expiresAt <= new Date()) {
      throw new ApiError("BAD_REQUEST", "过期时间必须晚于当前时间。", 400);
    }

    const { code, invite } = await createInvite({
      label: payload.label,
      role: payload.role,
      dailyLimitOverride: payload.dailyLimitOverride,
      maxRefImagesOverride: payload.maxRefImagesOverride,
      maxFileMbOverride: payload.maxFileMbOverride,
      expiresAt,
      createdById: admin.id,
    });

    return jsonOk({
      code,
      invite: publicInvite(invite),
    });
  } catch (error) {
    return jsonError(error);
  }
}
