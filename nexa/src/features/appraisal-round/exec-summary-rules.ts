/**
 * Pure rules of the executive summary of the detailed evaluation report (appraisal-boss-overview-mock.html): which teams
 * are scored, which need a look, who to talk to first, and the four headline numbers. No imports, so
 * `node --experimental-strip-types scripts/check-exec-summary.mjs` can run it. Display only: no score is recalculated.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;
const meanOf = (v: readonly number[]): number | null => (v.length === 0 ? null : r1(v.reduce((s, x) => s + x, 0) / v.length));
const deltaOf = (now: number | null, before: number | null): number | null => (now === null || before === null ? null : r1(now - before));

/**
 * The department name to show for a scored person. A round stores the department name as it was when the round was made;
 * departments are later renamed, split or removed (the warehouse "Online" and "Offline" ones no longer exist), which splits
 * one team into several rows and lines. A stored name that is still a live department stays; one that is gone is replaced by
 * the person's current department, so the report shows the structure as it is today. Display only: nothing is written back.
 */
export function resolveDepartment(stored: string | null, live: ReadonlySet<string>, current: string | null): string {
  if (stored && live.has(stored)) return stored;
  return current ?? stored ?? "ไม่ระบุแผนก";
}

/** Teams with fewer people than this show no team score: one or two scores would reveal a person and look alarming. */
export const MIN_TEAM_SIZE = 3;
/** A team that lost at least this many points since the earlier round is flagged "ลดลงมาก". */
export const TEAM_BIG_DROP = 5;
/** A person below 80, or who lost at least this many points, is listed under "ควรคุยก่อน". */
export const PERSON_BIG_DROP = 10;

/** ดี from 90, ปกติ 80-89, ควรดู below 80 (the same cut points as the colour groups of the HR sheets). */
export type BandTone = "good" | "ok" | "watch";

export const bandOf = (percent: number): BandTone => (percent >= 90 ? "good" : percent >= 80 ? "ok" : "watch");

export interface ExecTeamInput {
  department: string;
  count: number;
  avg: number;
  delta: number | null;
}

export interface ExecTeam extends ExecTeamInput {
  tone: BandTone;
  bigDrop: boolean;
}

const TONE_ORDER: Record<BandTone, number> = { watch: 0, ok: 1, good: 2 };

/** Teams big enough to score, the ones to look at first on top (below 80, then the biggest drops); the rest are the small teams. */
export function execTeams(teams: readonly ExecTeamInput[]): { shown: ExecTeam[]; small: ExecTeamInput[] } {
  const shown = teams
    .filter((t) => t.count >= MIN_TEAM_SIZE)
    .map((t): ExecTeam => ({ ...t, tone: bandOf(t.avg), bigDrop: t.delta !== null && t.delta <= -TEAM_BIG_DROP }))
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (a.delta ?? 0) - (b.delta ?? 0) || a.avg - b.avg || a.department.localeCompare(b.department, "th"));
  return { shown, small: teams.filter((t) => t.count < MIN_TEAM_SIZE) };
}

/** A team the executive summary counts as "ควรดู": below 80, or a big drop. */
export const teamNeedsLook = (t: ExecTeam): boolean => t.tone === "watch" || t.bigDrop;

export interface ExecPersonInput {
  participantId: string;
  total: number;
  delta: number | null;
}

/** People below 80 or down by PERSON_BIG_DROP or more, lowest score first. */
export function watchPeople<T extends ExecPersonInput>(people: readonly T[]): T[] {
  return people
    .filter((p) => p.total < 80 || (p.delta !== null && p.delta <= -PERSON_BIG_DROP))
    .sort((a, b) => a.total - b.total || (a.delta ?? 0) - (b.delta ?? 0));
}

/** The people who rose most since their earlier round (only real rises), biggest first. */
export function bestMovers<T extends ExecPersonInput>(people: readonly T[], limit = 3): T[] {
  return people
    .filter((p) => p.delta !== null && p.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0) || b.total - a.total)
    .slice(0, limit);
}

export interface ExecHeadline {
  avg: number | null;
  prevAvg: number | null;
  delta: number | null;
  /** Sheets submitted out of asked, and the share of them. */
  submitted: number;
  asked: number;
  submittedPct: number;
  low: number;
  /** People below 80 in their earlier round, counted among those who have one; null when nobody has an earlier score. */
  lowBefore: number | null;
  full: number;
  fullPct: number;
  people: number;
}

/** The four numbers and the sentence of the executive summary. `companySeries` runs oldest to newest and ends with the chosen round. */
export function execHeadline(
  people: readonly { total: number; prev: number | null }[],
  progress: { submitted: number; total: number },
  companySeries: readonly (number | null)[],
): ExecHeadline {
  const avg = companySeries.length ? companySeries[companySeries.length - 1]! : meanOf(people.map((p) => p.total));
  const prevAvg = companySeries.length > 1 ? companySeries[companySeries.length - 2]! : null;
  const withPrev = people.filter((p) => p.prev !== null);
  const full = people.filter((p) => p.total === 100).length;
  return {
    avg,
    prevAvg,
    delta: deltaOf(avg, prevAvg),
    submitted: progress.submitted,
    asked: progress.total,
    submittedPct: progress.total ? Math.round((progress.submitted / progress.total) * 100) : 0,
    low: people.filter((p) => p.total < 80).length,
    lowBefore: withPrev.length ? withPrev.filter((p) => (p.prev as number) < 80).length : null,
    full,
    fullPct: people.length ? Math.round((full / people.length) * 100) : 0,
    people: people.length,
  };
}
