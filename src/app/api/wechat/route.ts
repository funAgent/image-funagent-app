import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import {
  extractLoginCode,
  parseWeChatXml,
  textReply,
  verifyWeChatSignature,
} from "@/lib/wechat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const signature = request.nextUrl.searchParams.get("signature");
  const timestamp = request.nextUrl.searchParams.get("timestamp");
  const nonce = request.nextUrl.searchParams.get("nonce");
  const echostr = request.nextUrl.searchParams.get("echostr");

  if (!verifyWeChatSignature({ signature, timestamp, nonce }) || !echostr) {
    return new Response("invalid signature", { status: 401 });
  }

  return new Response(echostr, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const signature = request.nextUrl.searchParams.get("signature");
  const timestamp = request.nextUrl.searchParams.get("timestamp");
  const nonce = request.nextUrl.searchParams.get("nonce");

  if (!verifyWeChatSignature({ signature, timestamp, nonce })) {
    return new Response("invalid signature", { status: 401 });
  }

  const rawBody = await request.text();
  const message = parseWeChatXml(rawBody);
  if (!message) {
    return new Response("success");
  }

  const code = extractLoginCode(message.Content);
  if (!code) {
    return xmlResponse(
      textReply(
        message.FromUserName,
        message.ToUserName,
        "打开 image.funagent.app 获取登录码，然后发送“登录 123456”。",
      ),
    );
  }

  const attempt = await prisma.loginAttempt.findUnique({ where: { code } });
  if (!attempt || attempt.status !== "PENDING" || attempt.expiresAt <= new Date()) {
    return xmlResponse(
      textReply(
        message.FromUserName,
        message.ToUserName,
        "登录码已失效，请回到页面重新获取。",
      ),
    );
  }

  const user = await prisma.user.upsert({
    where: { wechatOpenId: message.FromUserName },
    create: {
      wechatOpenId: message.FromUserName,
      role: appEnv.adminOpenIds.has(message.FromUserName) ? "ADMIN" : "USER",
    },
    update: {
      role: appEnv.adminOpenIds.has(message.FromUserName) ? "ADMIN" : undefined,
    },
  });

  await prisma.loginAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "CONFIRMED",
      userId: user.id,
      confirmedAt: new Date(),
    },
  });

  return xmlResponse(
    textReply(
      message.FromUserName,
      message.ToUserName,
      "登录成功，可以回到页面继续生成图片。",
    ),
  );
}

function xmlResponse(body: string) {
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
