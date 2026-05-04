import { z } from "zod";
import { createSession, setSessionCookie } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { redeemInviteCode } from "@/lib/invites";
import { RATE_LIMITS, rateLimitByIp } from "@/lib/rate-limit";
import { publicUser } from "@/lib/serializers";

export const runtime = "nodejs";

const inviteLoginSchema = z.object({
  code: z.string().min(4).max(64),
});

export async function POST(request: Request) {
  try {
    await rateLimitByIp(RATE_LIMITS.inviteLogin);
    const payload = inviteLoginSchema.parse(await request.json());
    const user = await redeemInviteCode(payload.code);
    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);

    return jsonOk({ user: publicUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
