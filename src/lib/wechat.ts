import crypto from "node:crypto";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

type WeChatTextMessage = {
  ToUserName: string;
  FromUserName: string;
  CreateTime: number;
  MsgType: string;
  Content?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  cdataPropName: "__cdata",
  format: false,
});

export function verifyWeChatSignature(input: {
  signature: string | null;
  timestamp: string | null;
  nonce: string | null;
}) {
  const token = process.env.WECHAT_TOKEN;
  if (!token || !input.signature || !input.timestamp || !input.nonce) {
    return false;
  }

  const digest = [token, input.timestamp, input.nonce]
    .sort()
    .join("")
    .trim();
  const sha1 = crypto.createHash("sha1").update(digest).digest("hex");
  return sha1 === input.signature;
}

export function parseWeChatXml(xml: string): WeChatTextMessage | null {
  const parsed = parser.parse(xml);
  const message = parsed?.xml;
  if (!message?.FromUserName || !message?.ToUserName || !message?.MsgType) {
    return null;
  }
  return message as WeChatTextMessage;
}

export function extractLoginCode(content?: string) {
  if (!content) return null;
  const match = content.match(/(?:登录|登錄|login)\s*[:：]?\s*(\d{6})/i);
  return match?.[1] ?? null;
}

export function textReply(toUser: string, fromUser: string, content: string) {
  return builder.build({
    xml: {
      ToUserName: { __cdata: toUser },
      FromUserName: { __cdata: fromUser },
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: { __cdata: "text" },
      Content: { __cdata: content },
    },
  });
}
