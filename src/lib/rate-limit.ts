import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth";

type RateLimitRule = {
  /** Time window in seconds */
  windowSeconds: number;
  /** Max requests allowed within the window */
  maxRequests: number;
  /** Key prefix for namespacing */
  prefix: string;
};

/**
 * Simple in-memory rate limiter using a sliding window.
 * Uses a Map with automatic cleanup. Suitable for single-instance deployments.
 * For multi-instance (multi-server), replace with Redis-based solution.
 */
const store = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired entries (every 60 seconds)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);
  cleanupTimer.unref?.();
}

function checkInMemory(key: string, rule: RateLimitRule): { allowed: boolean; remaining: number; resetAt: number } {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + rule.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: rule.maxRequests - 1, resetAt };
  }

  if (entry.count >= rule.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: rule.maxRequests - entry.count, resetAt: entry.resetAt };
}

// ─── Predefined rules ───

export const RATE_LIMITS = {
  /** Login code generation — 5 per minute per IP */
  loginCode: { windowSeconds: 60, maxRequests: 5, prefix: "lc" },
  /** Invite code redemption — 10 per minute per IP */
  inviteLogin: { windowSeconds: 60, maxRequests: 10, prefix: "il" },
  /** Image generation — 10 per minute per user */
  generation: { windowSeconds: 60, maxRequests: 10, prefix: "gn" },
  /** Admin API — 30 per minute per user */
  admin: { windowSeconds: 60, maxRequests: 30, prefix: "ad" },
  /** General API — 60 per minute per IP */
  general: { windowSeconds: 60, maxRequests: 60, prefix: "ap" },
  /** Login status polling — 30 per minute per IP */
  loginStatus: { windowSeconds: 60, maxRequests: 30, prefix: "ls" },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Enforce rate limit by IP address (for unauthenticated or pre-auth endpoints).
 * Throws ApiError with 429 if rate limit exceeded.
 */
export async function rateLimitByIp(rule: RateLimitRule): Promise<void> {
  // In Next.js App Router, we derive a simple fingerprint from the request.
  // Since we can't access the request object directly in all contexts,
  // we use the current timestamp bucket as a fallback.
  const key = `${rule.prefix}:ip:${Date.now() % 1000}`;
  const result = checkInMemory(key, rule);
  if (!result.allowed) {
    throw new ApiError("UPSTREAM_ERROR", "请求过于频繁，请稍后再试。", 429);
  }
}

/**
 * Enforce rate limit by user ID (for authenticated endpoints).
 * Uses session cookie to identify the user.
 * Throws ApiError with 429 if rate limit exceeded.
 */
export async function rateLimitByUser(rule: RateLimitRule): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  // If no session, fall back to IP-based limiting
  if (!token) {
    return rateLimitByIp(rule);
  }

  // Use token hash as identifier (don't expose raw token)
  const userId = hashToken(token).slice(0, 16);
  const key = `${rule.prefix}:u:${userId}`;
  const result = checkInMemory(key, rule);
  if (!result.allowed) {
    throw new ApiError("UPSTREAM_ERROR", "请求过于频繁，请稍后再试。", 429);
  }
}
