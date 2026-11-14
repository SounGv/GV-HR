/**
 * Small pure helpers for the assistant's read-only tools (src/lib/ai/read-tools.ts).
 * No server or database imports, so scripts/check-ai-read-summary.mjs can test them directly.
 */

export const LEAVE_LABEL: Record<string, string> = {
  ANNUAL: "ลาพักร้อน",
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  UNPAID: "ลาไม่รับค่าจ้าง",
  OTHER: "ลาอื่นๆ",
  HOLIDAY_SWAP: "ใช้สิทธิ์วันหยุด",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One line of "เช็คโควตา": what is left once the days waiting for approval are counted. */
export function balanceLine(type: string, totalDays: number, usedDays: number, pendingDays: number) {
  return {
    type: LEAVE_LABEL[type] ?? type,
    totalDays: round1(totalDays),
    usedDays: round1(usedDays),
    pendingDays: round1(pendingDays),
    remainingDays: round1(totalDays - usedDays - pendingDays),
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function validDay(s: string): boolean {
  if (!ISO_DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const addDays = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

/**
 * The dates a schedule question covers. Defaults to today through the next 6 days; a missing or
 * invalid end falls back to 6 days after the start; a range longer than `maxDays` is cut short and says so.
 */
export function clampRange(from: unknown, to: unknown, today: string, maxDays = 31): { from: string; to: string; cut: boolean } {
  const start = typeof from === "string" && validDay(from) ? from : today;
  let end = typeof to === "string" && validDay(to) ? to : addDays(start, 6);
  if (end < start) end = start;
  const last = addDays(start, maxDays - 1);
  if (end > last) return { from: start, to: last, cut: true };
  return { from: start, to: end, cut: false };
}

/** Today in Bangkok (UTC+7) as YYYY-MM-DD; the server clock is UTC. */
export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}

/** Share done as a whole percent; 0 when nothing is expected, so a new round never shows NaN. */
export function percentDone(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
