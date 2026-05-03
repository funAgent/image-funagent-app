import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { publicUser } from "@/lib/serializers";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { ok: false, code: "FORBIDDEN", error: "生产环境未开启调试登录。" },
        { status: 403 },
      );
    }

    if (process.env.ALLOW_DEV_LOGIN !== "true") {
      return Response.json(
        { ok: false, code: "FORBIDDEN", error: "调试登录未开启。" },
        { status: 403 },
      );
    }

    const role = process.env.DEV_LOGIN_ROLE === "USER" ? "USER" : "ADMIN";
    const user = await prisma.user.upsert({
      where: { wechatOpenId: process.env.DEV_LOGIN_OPENID ?? "dev-openid" },
      create: {
        wechatOpenId: process.env.DEV_LOGIN_OPENID ?? "dev-openid",
        role,
      },
      update: { role },
    });

    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return jsonOk({ user: publicUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
