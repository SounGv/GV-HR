import { createHmac, timingSafeEqual } from "crypto";

/**
 * LINE Messaging API — real push/reply integration, gated on env config
 * (LINE_CHANNEL_ACCESS_TOKEN + LINE_CHANNEL_SECRET). Same graceful-degradation
 * pattern as email (RESEND_API_KEY) and AI (GEMINI_API_KEY): missing config
 * means "skip silently, don't crash the caller," not a hard failure.
 */

export function isLineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN && !!process.env.LINE_CHANNEL_SECRET;
}

/** Verifies the `x-line-signature` header against the raw request body. */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function callLineApi(path: string, body: unknown): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(`https://api.line.me${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[line] ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    console.error(`[line] ${path} request error:`, err);
  }
}

/** Best-effort push — never throws, so a LINE outage never blocks the caller. */
export async function pushLineMessage(lineUserId: string, text: string): Promise<void> {
  if (!isLineConfigured()) return;
  await callLineApi("/v2/bot/message/push", {
    to: lineUserId,
    messages: [{ type: "text", text: text.slice(0, 5000) }],
  });
}

export async function replyLineMessage(replyToken: string, text: string): Promise<void> {
  if (!isLineConfigured()) return;
  await callLineApi("/v2/bot/message/reply", {
    replyToken,
    messages: [{ type: "text", text: text.slice(0, 5000) }],
  });
}

/**
 * Best-effort push ไปยัง LINE group (ใช้ endpoint เดียวกับ pushLineMessage —
 * LINE Push API รับ userId/groupId/roomId ผ่าน field `to` เดียวกันทั้งหมด
 * ไม่มี endpoint แยก). ไม่ throw เหมือนกัน เพื่อไม่ให้ LINE ล่มแล้วบล็อก caller
 */
export async function pushLineGroupMessage(groupId: string, text: string): Promise<void> {
  if (!isLineConfigured()) return;
  await callLineApi("/v2/bot/message/push", {
    to: groupId,
    messages: [{ type: "text", text: text.slice(0, 5000) }],
  });
}

/** 6-char, unambiguous alphabet (no 0/O/1/I) — read out loud/typed by hand. */
export function generateLinkCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export const LINE_LINK_CODE_TTL_MS = 15 * 60 * 1000;
