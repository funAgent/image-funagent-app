import { type NextRequest, NextResponse } from "next/server";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://image.funagent.app";

/**
 * CSRF protection via Origin verification.
 * All state-changing requests (POST, PUT, PATCH, DELETE) to /api/ must
 * have an Origin header matching the canonical app URL.
 *
 * GET/HEAD/OPTIONS are safe methods and are not checked.
 * Webhook endpoints (/api/wechat) verify their own signatures.
 */
export function middleware(request: NextRequest) {
  const { method } = request;

  // Only protect state-changing methods on API routes
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  // Only apply to /api/ routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Wechat webhook validates its own signature separately
  if (pathname === "/api/wechat") {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const allowedOrigins = [appUrl, new URL(appUrl).origin];

  // If no origin (mobile SDK, curl, etc.), allow through — the session cookie
  // + SameSite=lax already provides protection for these cases.
  // The primary goal is to block cross-origin browser requests.
  if (!origin) {
    return NextResponse.next();
  }

  if (!allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "跨站请求被拒绝。" },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
