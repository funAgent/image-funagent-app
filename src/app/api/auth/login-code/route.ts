import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

const LOGIN_CODE_TTL_MINUTES = 10;

function randomLoginCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  try {
    const expiresAt = new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60 * 1000);

    await prisma.loginAttempt.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });

    let attempt = null;
    for (let tries = 0; tries < 5; tries += 1) {
      try {
        attempt = await prisma.loginAttempt.create({
          data: {
            code: randomLoginCode(),
            expiresAt,
          },
        });
        break;
      } catch {
        // Try a new 6-digit code on rare collisions.
      }
    }

    if (!attempt) {
      throw new Error("Unable to allocate login code");
    }

    return jsonOk({
      attemptId: attempt.id,
      code: attempt.code,
      command: `登录 ${attempt.code}`,
      expiresAt: attempt.expiresAt.toISOString(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
