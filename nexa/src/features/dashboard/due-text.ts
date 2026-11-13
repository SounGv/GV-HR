const DAY_MS = 86_400_000;

export type DueTone = "late" | "soon" | "ok";

/**
 * Days left until a round's last day, said the way staff say it:
 * "อีก 3 วัน", "วันนี้วันสุดท้าย", "เลยกำหนด 2 วัน". Both dates are Bangkok
 * calendar days as "YYYY-MM-DD", so the server's UTC clock never shifts them.
 */
export function dueText(endIso: string | null, todayIso: string): { text: string; tone: DueTone } {
  if (!endIso) return { text: "ยังไม่กำหนดวันปิด", tone: "ok" };
  const days = Math.round((Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return { text: `เลยกำหนด ${-days} วัน`, tone: "late" };
  if (days === 0) return { text: "วันนี้วันสุดท้าย", tone: "late" };
  return { text: `อีก ${days} วัน`, tone: days <= 3 ? "soon" : "ok" };
}
