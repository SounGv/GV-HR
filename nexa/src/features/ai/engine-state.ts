/**
 * When น้องวีบอท uses the AI service and when it switches to the built-in fallback (quick actions that run in our
 * own system). The rules only; reading and writing the state is src/lib/ai/engine.ts. No imports, so
 * scripts/check-ai-engine.mjs can test it directly.
 */

/** After the AI service failed for a lasting reason, wait this long before trying it again (one question is the probe). */
export const DOWN_RETRY_MS = 5 * 60 * 1000;

export type EngineHealth = { state: "ok" } | { state: "down"; since: number; reason: "credit" | "key" };
export type EngineDecision = { mode: "ai" } | { mode: "fallback"; reason: "credit" | "key" | "cap" };

/** Positive whole number from the setting, or null when it is missing or not a usable cap. */
export function readCap(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Which engine answers this question. A full monthly cap goes to the fallback without calling the service.
 * After a lasting failure the fallback answers until the retry time, then the next question tries the service
 * again (so it comes back by itself once the credit is topped up).
 */
export function decideEngine(input: { health: EngineHealth; used: number; cap: number | null; now: number }): EngineDecision {
  const { health, used, cap, now } = input;
  if (cap !== null && used >= cap) return { mode: "fallback", reason: "cap" };
  if (health.state === "down" && now - health.since < DOWN_RETRY_MS) return { mode: "fallback", reason: health.reason };
  return { mode: "ai" };
}

/** Whole percent of the cap used (0 when there is no cap). */
export function usagePercent(used: number, cap: number | null): number {
  return cap ? Math.floor((used / cap) * 100) : 0;
}

/** The warning level reached: 0, 80 or 100. */
export function capLevel(used: number, cap: number | null): 0 | 80 | 100 {
  const p = usagePercent(used, cap);
  return p >= 100 ? 100 : p >= 80 ? 80 : 0;
}

/** Start of the current month in Bangkok (UTC+7) as a UTC instant, so "this month" matches the calendar staff see. */
export function monthStartBangkok(now: Date): Date {
  const bkk = new Date(now.getTime() + 7 * 3600000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - 7 * 3600000);
}

export const FALLBACK_REPLY: Record<"credit" | "key" | "cap", string> = {
  credit: "AI หลักใช้ไม่ได้ชั่วคราว เครดิตหมด ตอนนี้ใช้ปุ่มลัดด้านล่างได้ตามปกติ ตอบจากข้อมูลในระบบ ไม่ใช้ AI ส่วนการร่างข้อความและอ่านไฟล์ PDF หรือรูปต้องรอ AI กลับมา ผู้ดูแลระบบได้รับแจ้งแล้ว",
  key: "AI หลักเชื่อมต่อไม่ได้ ตอนนี้ใช้ปุ่มลัดด้านล่างได้ตามปกติ ตอบจากข้อมูลในระบบ ไม่ใช้ AI ผู้ดูแลระบบได้รับแจ้งแล้ว",
  cap: "เดือนนี้ใช้ AI ครบเพดานที่ตั้งไว้แล้ว ตอนนี้ใช้ปุ่มลัดด้านล่างได้ตามปกติ ตอบจากข้อมูลในระบบ ไม่ใช้ AI จะกลับมาใช้ AI ได้ต้นเดือนหน้า หรือเมื่อผู้ดูแลปรับเพดาน",
};

export const FALLBACK_NOT_UNDERSTOOD =
  "โหมดสำรองยังตอบคำถามแบบนี้ไม่ได้ เพราะต้องใช้ AI ช่วยเข้าใจและเรียบเรียง ตอนนี้ช่วยได้ตามปุ่มลัดด้านล่าง หรือรอ AI กลับมาแล้วถามใหม่";

/** In-app notices for the administrators, once per event. */
export const ENGINE_NOTICE = {
  downCredit: { title: "AI หลักใช้ไม่ได้ ระบบสลับเป็นโหมดสำรองแล้ว", body: "เครดิตของบริการ AI หมด ผู้ใช้ยังใช้ปุ่มลัดได้ตามปกติ ให้ผู้ดูแลเติมเครดิตที่บัญชีของบริการ AI แล้วระบบจะกลับมาใช้ AI เอง" },
  downKey: { title: "AI หลักเชื่อมต่อไม่ได้ ระบบสลับเป็นโหมดสำรองแล้ว", body: "รหัสเชื่อมต่อบริการ AI ใช้ไม่ได้ ผู้ใช้ยังใช้ปุ่มลัดได้ตามปกติ ให้ผู้ดูแลตรวจการตั้งค่า แล้วระบบจะกลับมาใช้ AI เอง" },
  up: { title: "AI หลักกลับมาใช้ได้แล้ว", body: "ระบบกลับมาใช้ AI อัตโนมัติ ผู้ใช้ไม่ต้องทำอะไร" },
  cap80: { title: "ใช้ AI ไปแล้ว 80% ของเพดานเดือนนี้", body: "เมื่อครบเพดาน ระบบจะสลับเป็นโหมดสำรองเอง ดูการใช้งานและวิธีปรับเพดานได้ที่หน้าตั้งค่าน้องวีบอท" },
  cap100: { title: "ใช้ AI ครบเพดานเดือนนี้แล้ว ระบบสลับเป็นโหมดสำรอง", body: "ผู้ใช้ยังใช้ปุ่มลัดได้ตามปกติ จะกลับมาใช้ AI ต้นเดือนหน้า หรือเมื่อปรับเพดาน ดูรายละเอียดที่หน้าตั้งค่าน้องวีบอท" },
} as const;
