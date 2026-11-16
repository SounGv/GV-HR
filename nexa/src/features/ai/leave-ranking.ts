/**
 * "ใครลาเยอะสุด N อันดับ แยกประเภทลา": who took the most approved leave days in a year
 * (pure, no imports; checked by `node --experimental-strip-types scripts/check-leave-ranking.mjs`).
 *
 * Counts days only. Leave taken by the hour is left out and the answer says so, because how many hours make a day is HR's rule
 * and is not guessed here.
 */

export interface LeaveRow {
  employeeId: string;
  name: string;
  department: string;
  /** Already in words, e.g. ลาป่วย. */
  typeLabel: string;
  days: number;
}

export interface LeaveRankLine {
  employeeId: string;
  name: string;
  department: string;
  totalDays: number;
  /** "ลาป่วย 3, ลากิจ 1.5", biggest first. */
  breakdown: string;
}

export interface LeaveRanking {
  lines: LeaveRankLine[];
  /** People with leave in the year, before the cut to the top N. */
  people: number;
  /** People tied with the last listed person who did not fit, so a tie is never shown as a complete list. */
  tiedBeyond: number;
}

export const LEAVE_RANK_DEFAULT = 5;
export const LEAVE_RANK_MAX = 20;

/** Days with at most one decimal (half days exist), no trailing ".0". */
export const dayText = (n: number) => String(Math.round(n * 10) / 10);

export function clampTop(n: number | undefined): number {
  if (!Number.isFinite(n) || !n || n < 1) return LEAVE_RANK_DEFAULT;
  return Math.min(Math.floor(n), LEAVE_RANK_MAX);
}

export function rankLeave(rows: readonly LeaveRow[], top: number): LeaveRanking {
  const byPerson = new Map<string, { name: string; department: string; total: number; byType: Map<string, number> }>();
  for (const r of rows) {
    if (!(r.days > 0)) continue;
    const p = byPerson.get(r.employeeId) ?? { name: r.name, department: r.department, total: 0, byType: new Map<string, number>() };
    p.total += r.days;
    p.byType.set(r.typeLabel, (p.byType.get(r.typeLabel) ?? 0) + r.days);
    byPerson.set(r.employeeId, p);
  }
  const all = [...byPerson.entries()]
    .map(([employeeId, p]) => ({
      employeeId,
      name: p.name,
      department: p.department,
      totalDays: Math.round(p.total * 10) / 10,
      breakdown: [...p.byType.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
        .map(([label, d]) => `${label} ${dayText(d)}`)
        .join(", "),
    }))
    .sort((a, b) => b.totalDays - a.totalDays || a.name.localeCompare(b.name, "th"));
  const lines = all.slice(0, top);
  const last = lines[lines.length - 1];
  const tiedBeyond = last ? all.slice(top).filter((x) => x.totalDays === last.totalDays).length : 0;
  return { lines, people: all.length, tiedBeyond };
}
