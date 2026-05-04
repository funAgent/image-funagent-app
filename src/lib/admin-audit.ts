import type {
  AdminAuditAction,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

type AuditLogInput = {
  action: AdminAuditAction;
  actorUserId?: string | null;
  targetUserId?: string | null;
  targetInviteId?: string | null;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createAdminAuditLog(
  input: AuditLogInput,
  db: DbClient = prisma,
) {
  return db.adminAuditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      targetInviteId: input.targetInviteId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata,
    },
  });
}

export function quotaSnapshot(input: {
  dailyLimitOverride: number | null;
  maxRefImagesOverride: number | null;
  maxFileMbOverride: number | null;
}) {
  return {
    dailyLimitOverride: input.dailyLimitOverride,
    maxRefImagesOverride: input.maxRefImagesOverride,
    maxFileMbOverride: input.maxFileMbOverride,
  };
}

export function quotaChanges(
  before: ReturnType<typeof quotaSnapshot>,
  after: ReturnType<typeof quotaSnapshot>,
) {
  const changes: Record<string, { before: number | null; after: number | null }> = {};

  if (before.dailyLimitOverride !== after.dailyLimitOverride) {
    changes.dailyLimitOverride = {
      before: before.dailyLimitOverride,
      after: after.dailyLimitOverride,
    };
  }

  if (before.maxRefImagesOverride !== after.maxRefImagesOverride) {
    changes.maxRefImagesOverride = {
      before: before.maxRefImagesOverride,
      after: after.maxRefImagesOverride,
    };
  }

  if (before.maxFileMbOverride !== after.maxFileMbOverride) {
    changes.maxFileMbOverride = {
      before: before.maxFileMbOverride,
      after: after.maxFileMbOverride,
    };
  }

  return changes;
}

export function hasQuotaChanges(changes: ReturnType<typeof quotaChanges>) {
  return Object.keys(changes).length > 0;
}
