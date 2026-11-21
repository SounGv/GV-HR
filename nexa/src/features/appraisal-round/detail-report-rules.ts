/**
 * Small pure helpers for the detailed evaluation report (no imports; checked by
 * `node --experimental-strip-types scripts/check-detail-report.mjs`).
 */

export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Plain mean rounded to one decimal, or null for an empty list. */
export function meanOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : r1(values.reduce((s, v) => s + v, 0) / values.length);
}

/** Competition ranking from the highest: equal scores share a rank and the next rank skips (100, 100, 90 is 1, 1, 3). */
export function ranksFor(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

/** Difference to one decimal, or null when either side is missing. */
export function deltaOf(now: number | null, before: number | null): number | null {
  return now === null || before === null ? null : r1(now - before);
}

export interface ScoredRow {
  roundId: string;
  employeeId: string;
  department: string;
  score: number;
}

export interface RoundStamp {
  id: string;
  /** Sortable time the round started (milliseconds). */
  at: number;
}

/**
 * The score a person got in the nearest round before `roundId` (rounds are compared by time), or null when they
 * were not scored in an earlier round.
 */
export function previousScore(rows: readonly ScoredRow[], rounds: readonly RoundStamp[], roundId: string, employeeId: string): number | null {
  const at = rounds.find((r) => r.id === roundId)?.at;
  if (at === undefined) return null;
  const earlier = rounds.filter((r) => r.at < at).sort((a, b) => b.at - a.at);
  for (const r of earlier) {
    const hit = rows.find((x) => x.roundId === r.id && x.employeeId === employeeId);
    if (hit) return hit.score;
  }
  return null;
}

/** The mean of a department in the nearest earlier round where it has anyone scored. */
export function previousDepartmentMean(rows: readonly ScoredRow[], rounds: readonly RoundStamp[], roundId: string, department: string): number | null {
  const at = rounds.find((r) => r.id === roundId)?.at;
  if (at === undefined) return null;
  const earlier = rounds.filter((r) => r.at < at).sort((a, b) => b.at - a.at);
  for (const r of earlier) {
    const m = meanOf(rows.filter((x) => x.roundId === r.id && x.department === department).map((x) => x.score));
    if (m !== null) return m;
  }
  return null;
}

/** Mean percent (0-100) per section over rating answers; sections with no rating answer are left out. */
export function sectionPercents(
  questions: readonly { id: string; answerType: string; section?: string | null }[],
  sheets: readonly { questionId?: unknown; value?: unknown }[][],
  ratingMax: number,
): Map<string, number> {
  const section = new Map(questions.filter((q) => q.answerType === "RATING").map((q) => [q.id, q.section?.trim() || "ทั่วไป"]));
  const sums = new Map<string, number[]>();
  for (const sheet of sheets) {
    for (const a of sheet) {
      if (typeof a.questionId !== "string" || typeof a.value !== "number") continue;
      const sec = section.get(a.questionId);
      if (!sec || a.value < 1 || a.value > ratingMax) continue;
      sums.set(sec, [...(sums.get(sec) ?? []), (a.value / ratingMax) * 100]);
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of sums) out.set(k, r1(v.reduce((s, x) => s + x, 0) / v.length));
  return out;
}

/** The colour group of a score on the report tables, as in the HR sheets (full marks green, then pale green, yellow, pink). Display only. */
export type ScoreTone = "full" | "high" | "mid" | "low";

export const SCORE_TONES: readonly { tone: ScoreTone; label: string; from: number }[] = [
  { tone: "full", label: "100", from: 100 },
  { tone: "high", label: "90-99", from: 90 },
  { tone: "mid", label: "80-89", from: 80 },
  { tone: "low", label: "ต่ำกว่า 80", from: 0 },
];

export function toneOf(percent: number): ScoreTone {
  return (SCORE_TONES.find((x) => percent >= x.from) ?? SCORE_TONES[SCORE_TONES.length - 1]!).tone;
}

const MONTHS: [string, string][] = [
  ["มกราคม", "ม.ค."],
  ["กุมภาพันธ์", "ก.พ."],
  ["มีนาคม", "มี.ค."],
  ["เมษายน", "เม.ย."],
  ["พฤษภาคม", "พ.ค."],
  ["มิถุนายน", "มิ.ย."],
  ["กรกฎาคม", "ก.ค."],
  ["สิงหาคม", "ส.ค."],
  ["กันยายน", "ก.ย."],
  ["ตุลาคม", "ต.ค."],
  ["พฤศจิกายน", "พ.ย."],
  ["ธันวาคม", "ธ.ค."],
];

/**
 * The month a round is about, read from its name when the name starts with a Thai month and a Buddhist year
 * ("กันยายน 2569 หัวหน้าประเมินลูกน้อง" gives "ก.ย. 69"), otherwise null. A round about September is often opened in October,
 * so the start date alone would put it under the wrong month in the comparison columns.
 */
export function monthLabelFromName(name: string): string | null {
  const m = /^\s*(\S+)\s+(25\d{2})(?!\d)/.exec(name);
  if (!m) return null;
  const hit = MONTHS.find(([full]) => full === m[1]);
  return hit ? `${hit[1]} ${m[2]!.slice(2)}` : null;
}
