import crypto from "node:crypto";
import { Prisma, type UserRole } from "@/generated/prisma/client";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/db";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashInviteCode(input: string) {
  return crypto
    .createHash("sha256")
    .update(`funagent-invite:${normalizeInviteCode(input)}`)
    .digest("hex");
}

export function createInviteCodeValue() {
  const bytes = crypto.randomBytes(8);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `FA-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

export function invitePreview(code: string) {
  const normalized = normalizeInviteCode(code);
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export async function createInvite(input: {
  label?: string | null;
  role?: UserRole;
  dailyLimitOverride?: number | null;
  maxRefImagesOverride?: number | null;
  maxFileMbOverride?: number | null;
  expiresAt?: Date | null;
  createdById?: string | null;
}) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createInviteCodeValue();
    try {
      const invite = await prisma.inviteCode.create({
        data: {
          codeHash: hashInviteCode(code),
          codePreview: invitePreview(code),
          label: input.label?.trim() || null,
          role: input.role ?? "USER",
          dailyLimitOverride: input.dailyLimitOverride,
          maxRefImagesOverride: input.maxRefImagesOverride,
          maxFileMbOverride: input.maxFileMbOverride,
          expiresAt: input.expiresAt,
          createdById: input.createdById,
        },
      });

      return { code, invite };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to create invite code");
}

export async function redeemInviteCode(rawCode: string) {
  const normalized = normalizeInviteCode(rawCode);
  if (normalized.length < 8) {
    throw new ApiError("BAD_REQUEST", "邀请码格式不正确。", 400);
  }

  const codeHash = hashInviteCode(normalized);
  const invite = await prisma.inviteCode.findUnique({
    where: { codeHash },
    include: { user: true },
  });

  if (!invite) {
    throw new ApiError("UNAUTHORIZED", "邀请码无效。", 401);
  }

  if (invite.disabledAt) {
    throw new ApiError("FORBIDDEN", "邀请码已停用。", 403);
  }

  if (invite.expiresAt && invite.expiresAt <= new Date()) {
    throw new ApiError("FORBIDDEN", "邀请码已过期。", 403);
  }

  if (invite.user) {
    if (invite.user.status !== "ACTIVE") {
      throw new ApiError("FORBIDDEN", "账号已被停用。", 403);
    }

    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return invite.user;
  }

  const user = await prisma.user.create({
    data: {
      nickname: invite.label,
      role: invite.role,
      dailyLimitOverride: invite.dailyLimitOverride,
      maxRefImagesOverride: invite.maxRefImagesOverride,
      maxFileMbOverride: invite.maxFileMbOverride,
    },
  });

  const claimed = await prisma.inviteCode.updateMany({
    where: { id: invite.id, userId: null },
    data: {
      userId: user.id,
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  if (claimed.count === 1) {
    return user;
  }

  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  const currentInvite = await prisma.inviteCode.findUnique({
    where: { id: invite.id },
    include: { user: true },
  });

  if (currentInvite?.user) {
    return currentInvite.user;
  }

  throw new ApiError("UPSTREAM_ERROR", "邀请码登录失败，请重试。", 500);
}

export function publicInvite(invite: {
  id: string;
  codePreview: string;
  label: string | null;
  role: UserRole;
  dailyLimitOverride: number | null;
  maxRefImagesOverride: number | null;
  maxFileMbOverride: number | null;
  expiresAt: Date | null;
  disabledAt: Date | null;
  useCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  userId: string | null;
}) {
  return {
    id: invite.id,
    codePreview: invite.codePreview,
    label: invite.label,
    role: invite.role,
    dailyLimitOverride: invite.dailyLimitOverride,
    maxRefImagesOverride: invite.maxRefImagesOverride,
    maxFileMbOverride: invite.maxFileMbOverride,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    disabledAt: invite.disabledAt?.toISOString() ?? null,
    useCount: invite.useCount,
    lastUsedAt: invite.lastUsedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    claimed: Boolean(invite.userId),
  };
}
