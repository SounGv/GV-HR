import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * LINE Messaging API — real push/reply integration, gated on env config
 * (LINE_CHANNEL_ACCESS_TOKEN + LINE_CHANNEL_SECRET). Same graceful-degradation
 * pattern as email (RESEND_API_KEY) and AI (ANTHROPIC_API_KEY): missing config
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

/**
 * Sends after the response (see after-response.ts). Loaded on use so this file
 * stays importable by the plain-Node check scripts, which have no "@/" alias
 * and no Next.js request.
 */
async function sendAfterResponse(to: string, text: string): Promise<void> {
  const { runAfterResponse } = await import("@/lib/after-response");
  await runAfterResponse(() => sendLinePush(to, text));
}

/**
 * Sends one push now (user, group or room id all go in `to`). Never throws.
 * Callers inside a request use pushLineMessage / pushLineGroupMessage, which
 * send after the response; this is for work that already runs after it.
 */
export async function sendLinePush(to: string, text: string): Promise<void> {
  if (!isLineConfigured()) return;
  await callLineApi("/v2/bot/message/push", {
    to,
    messages: [{ type: "text", text: text.slice(0, 5000) }],
  });
}

/**
 * Best-effort push — never throws, so a LINE outage never blocks the caller,
 * and it is sent after the response so the caller never waits on LINE either.
 */
export async function pushLineMessage(lineUserId: string, text: string): Promise<void> {
  if (!isLineConfigured()) return;
  await sendAfterResponse(lineUserId, text);
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
  await sendAfterResponse(groupId, text);
}

/** 6-char, unambiguous alphabet (no 0/O/1/I) — read out loud/typed by hand. */
export function generateLinkCode(): string {
  // CSPRNG, not Math.random() — this code links an arbitrary LINE account to
  // an employee record, so a predictable/guessable code is a real account-
  // linking weakness. Same alphabet/approach as auth/totp.ts's recovery
  // codes (32 chars, divides 256 evenly, so byte % alphabet.length is
  // unbiased).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (const byte of randomBytes(6)) code += alphabet[byte % alphabet.length];
  return code;
}

export const LINE_LINK_CODE_TTL_MS = 15 * 60 * 1000;

/** What a link code looks like: 6 characters from the alphabet above. */
const LINK_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/**
 * True when a chat message is shaped like an account-link code.
 *
 * The bot is shared with other services (gv-ops-bot), so the HR webhook may
 * only react to messages meant for it; anything else, such as a normal chat or
 * a broadcast reply, must be left alone and get no answer from here.
 *
 * @param text Message text as received from LINE.
 */
export function isLinkCodeText(text: string | undefined | null): boolean {
  return LINK_CODE_RE.test((text ?? "").trim().toUpperCase());
}

/**
 * Whether the bot may register a group as an HR-alert target when it is
 * invited. Off by default: a bot shared with another service gets invited to
 * that service's groups, and HR alerts must never land there. Set
 * LINE_REGISTER_HR_GROUPS=true only for a bot used for HR alone.
 */
export function shouldRegisterHrGroups(): boolean {
  return process.env.LINE_REGISTER_HR_GROUPS === "true";
}

let basicIdCache: { value: string | null; at: number } | null = null;

/**
 * The bot's basic id (e.g. "@409eeoji"), read from LINE's /v2/bot/info so the
 * app never needs it as config. Remembered for a day per server instance.
 * null when LINE is not configured or the call fails.
 */
export async function getLineBotBasicId(): Promise<string | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  if (basicIdCache && Date.now() - basicIdCache.at < 86_400_000) return basicIdCache.value;
  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    const value = res.ok ? (((await res.json()) as { basicId?: string }).basicId ?? null) : null;
    basicIdCache = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
}

/**
 * Whether this LINE user has the bot as a friend (only friends can get pushes).
 * true / false from LINE's profile endpoint (404 = not a friend), null if unknown.
 */
export async function isLineFriend(lineUserId: string): Promise<boolean | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

/**
 * Link that opens the bot's chat in the LINE app with `text` already typed, so
 * the person only taps send. https://line.me/R/oaMessage/{basicId}/?{text}
 */
export function lineChatWithTextUrl(basicId: string, text: string): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(basicId)}/?${encodeURIComponent(text)}`;
}
