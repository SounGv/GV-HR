/**
 * Rules for HR adjusting a calculated score by hand (pure, no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-adjust.mjs`).
 *
 * Owner's decisions, 15 Nov 2026: only HR may adjust; at most 5 points from the score the calculation gave; a reason
 * every time; only a result that is calculated and not yet approved can be adjusted.
 */

/** The largest change from the calculated score, in percentage points. */
export const MAX_ADJUST_POINTS = 5;
/** Characters a reason needs, so "ok" or a dot is not accepted. */
export const MIN_REASON_LENGTH = 10;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The percentage as it will be stored: one decimal place. */
export const roundPercent = r1;

export interface AdjustInput {
  /** What the calculation gave (kept even after later adjustments). */
  original: number;
  /** The score now (the original, or an earlier adjustment). */
  current: number;
  next: number;
  reason: string;
}

/**
 * Why this adjustment is not allowed, in words for the person doing it; null when it is fine.
 * The limit is measured from the original, so adjusting twice cannot add up to more than the limit.
 */
export function checkAdjustment({ original, current, next, reason }: AdjustInput): string | null {
  if (!Number.isFinite(next) || next < 0 || next > 100) return "คะแนนต้องอยู่ระหว่าง 0 ถึง 100";
  const to = r1(next);
  if (to === r1(current)) return "คะแนนใหม่เท่าเดิม ถ้าไม่ต้องการปรับให้กดยกเลิก";
  if (Math.abs(to - r1(original)) > MAX_ADJUST_POINTS + 1e-9) {
    const lo = r1(Math.max(0, original - MAX_ADJUST_POINTS));
    const hi = r1(Math.min(100, original + MAX_ADJUST_POINTS));
    return `ปรับได้ไม่เกิน ${MAX_ADJUST_POINTS} จุดจากคะแนนที่คำนวณได้ (${r1(original)}) ใส่ค่าระหว่าง ${lo} ถึง ${hi}`;
  }
  if (reason.trim().length < MIN_REASON_LENGTH) return `เขียนเหตุผลอย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร เพื่อให้คนอนุมัติเข้าใจว่าทำไมปรับ`;
  return null;
}

/** Undoing an adjustment needs a reason of the same length; returns why it is refused, null when fine. */
export function checkRevert(reason: string): string | null {
  return reason.trim().length < MIN_REASON_LENGTH ? `เขียนเหตุผลอย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร ว่าทำไมจึงยกเลิกการปรับ` : null;
}

/** Only a calculated result that nobody has approved yet may be adjusted (approval locks the number). */
export const canAdjustStatus = (status: string): boolean => status === "CALCULATED";
