import { type NextRequest } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { publicUser } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const attemptId = request.nextUrl.searchParams.get("attemptId");
    if (!attemptId) {
      throw new ApiError("BAD_REQUEST", "缺少登录请求。", 400);
    }

    const attempt = await prisma.loginAttempt.findUnique({
      where: { id: attemptId },
      include: { user: true },
    });

    if (!attempt) {
      throw new ApiError("NOT_FOUND", "登录码不存在。", 404);
    }

    if (attempt.status === "PENDING" && attempt.expiresAt <= new Date()) {
      await prisma.loginAttempt.update({
        where: { id: attempt.id },
        data: { status: "EXPIRED" },
      });
      return jsonOk({ status: "EXPIRED" });
    }

    if (attempt.status !== "CONFIRMED" || !attempt.user) {
      return jsonOk({ status: attempt.status });
    }

    const session = await createSession(attempt.user.id);
    await setSessionCookie(session.token, session.expiresAt);

    await prisma.loginAttempt.update({
      where: { id: attempt.id },
      data: { status: "EXPIRED" },
    });

    return jsonOk({
      status: "CONFIRMED",
      user: publicUser(attempt.user),
    });
  } catch (error) {
    return jsonError(error);
  }
}
