import { clearSessionCookie, hashToken, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashToken(token) },
      });
    }
    await clearSessionCookie();
    return jsonOk({});
  } catch (error) {
    return jsonError(error);
  }
}
