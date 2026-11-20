/**
 * The overview above the evaluation report: score spread, top and bottom lists and a department summary for one round
 * (pure, no imports; checked by `node --experimental-strip-types scripts/check-result-insights.mjs`).
 *
 * It only counts and sorts scores that are already in the report's table, so whoever sees a row sees the same numbers
 * here. Nothing here depends on grade bands being set, and nothing changes a score.
 */

export interface ScoredPerson {
  code: string;
  name: string;
  department: string;
  /** 0 to 100. */
  percent: number;
}

export interface ScoreBand {
  label: string;
  /** Lowest percent in the band (the band runs up to the next one). */
  from: number;
}

/** The last band is exactly 100: with a 1-3 scale most people land on 100 or 66.67, so "full marks" is its own bar. */
export const SCORE_BANDS: readonly ScoreBand[] = [
  { label: "ต่ำกว่า 60", from: 0 },
  { label: "60-69", from: 60 },
  { label: "70-79", from: 70 },
  { label: "80-89", from: 80 },
  { label: "90-99", from: 90 },
  { label: "100", from: 100 },
];

export interface DepartmentInsight {
  name: string;
  count: number;
  average: number;
  min: number;
  max: number;
  atTop: number;
}

export interface RoundInsight {
  id: string;
  name: string;
  count: number;
  average: number;
  min: number;
  max: number;
  /** People at exactly 100%. */
  atTop: number;
  bands: { label: string; count: number }[];
  /** Highest first; ties are in name order, so a long tie at 100% is a fixed list, not a random one. */
  top: ScoredPerson[];
  /** Lowest first. */
  bottom: ScoredPerson[];
  /** People tied with the last person in `top` who did not fit in the list (0 when the list is complete). */
  topTied: number;
  /** Same for `bottom`. */
  bottomTied: number;
  departments: DepartmentInsight[];
  /** Everyone in the round (the same rows the table below lists), by name; used to compare with the round before. */
  everyone: ScoredPerson[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const byName = (a: ScoredPerson, b: ScoredPerson) => a.name.localeCompare(b.name, "th") || a.code.localeCompare(b.code);

/** Which band a percent belongs to (the highest band whose start it reaches). */
export function bandIndex(percent: number): number {
  let i = 0;
  SCORE_BANDS.forEach((b, k) => {
    if (percent >= b.from) i = k;
  });
  return i;
}

export function summarizeRound(id: string, name: string, people: readonly ScoredPerson[], listSize = 10): RoundInsight {
  const empty = people.length === 0;
  const counts = SCORE_BANDS.map(() => 0);
  for (const p of people) counts[bandIndex(p.percent)]!++;
  // Ranked on the exact score, shown rounded to one decimal like every other figure on the page.
  const shown = (list: ScoredPerson[]) => list.map((x) => ({ ...x, percent: r1(x.percent) }));
  const highFirst = [...people].sort((a, b) => b.percent - a.percent || byName(a, b));
  const lowFirst = [...people].sort((a, b) => a.percent - b.percent || byName(a, b));
  const top = shown(highFirst.slice(0, listSize));
  const bottom = shown(lowFirst.slice(0, listSize));
  // Anyone tied with the last listed score who did not fit must be said, or the list reads as complete.
  const tiedBeyond = (sorted: ScoredPerson[]) => {
    const last = sorted[Math.min(listSize, sorted.length) - 1];
    return last ? sorted.filter((x) => x.percent === last.percent).length - sorted.slice(0, listSize).filter((x) => x.percent === last.percent).length : 0;
  };

  const byDept = new Map<string, ScoredPerson[]>();
  for (const p of people) {
    const list = byDept.get(p.department);
    if (list) list.push(p);
    else byDept.set(p.department, [p]);
  }
  const departments: DepartmentInsight[] = [...byDept.entries()]
    .map(([dept, list]) => ({
      name: dept,
      count: list.length,
      average: r1(list.reduce((s, p) => s + p.percent, 0) / list.length),
      min: r1(Math.min(...list.map((p) => p.percent))),
      max: r1(Math.max(...list.map((p) => p.percent))),
      atTop: list.filter((p) => p.percent >= 100).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  return {
    id,
    name,
    count: people.length,
    average: empty ? 0 : r1(people.reduce((s, p) => s + p.percent, 0) / people.length),
    min: empty ? 0 : r1(Math.min(...people.map((p) => p.percent))),
    max: empty ? 0 : r1(Math.max(...people.map((p) => p.percent))),
    atTop: people.filter((p) => p.percent >= 100).length,
    bands: SCORE_BANDS.map((b, i) => ({ label: b.label, count: counts[i]! })),
    top,
    bottom,
    topTied: tiedBeyond(highFirst),
    bottomTied: tiedBeyond(lowFirst),
    departments,
    everyone: shown([...people].sort(byName)),
  };
}

/** Points of average change that count as "better" or "worse" between two rounds. Starting value, HR confirms it (it only labels, nothing is scored from it). */
export const TREND_MIN_POINTS = 3;
/** A person whose own score fell by at least this many points is listed as worth a look. Starting value, HR confirms it. */
export const DROP_LOOK_POINTS = 5;

export type Trend = "up" | "down" | "same";
export const trendOf = (delta: number, min = TREND_MIN_POINTS): Trend => (delta >= min ? "up" : delta <= -min ? "down" : "same");

export interface RoundComparison {
  previous: RoundInsight;
  /** Average now minus average before, in points, over everyone in the current round. */
  averageDelta: number;
  departments: { name: string; now: number; before: number | null; delta: number | null }[];
  /** People in both rounds whose score fell by DROP_LOOK_POINTS or more, biggest fall first. */
  drops: { name: string; department: string; now: number; before: number; delta: number }[];
  /** People in both rounds whose score rose, biggest rise first (at most `limit`). */
  rises: { name: string; department: string; now: number; before: number; delta: number }[];
  /** How many people are in both rounds. */
  shared: number;
}

/**
 * The round to compare with: of the rounds listed after this one (older), the one that shares the most people with it, at least
 * half of this round's people. Two rounds that ask different people (a manager rating staff, staff rating the manager) share
 * almost nobody, so they are never compared with each other.
 */
export function previousRoundOf(rounds: readonly RoundInsight[], currentId: string): RoundInsight | undefined {
  const i = rounds.findIndex((r) => r.id === currentId);
  if (i < 0) return undefined;
  const cur = rounds[i]!;
  const codes = new Set(cur.everyone.map((p) => p.code));
  let best: RoundInsight | undefined;
  let bestShared = 0;
  for (const r of rounds.slice(i + 1)) {
    const shared = r.everyone.filter((p) => codes.has(p.code)).length;
    if (shared > bestShared) {
      best = r;
      bestShared = shared;
    }
  }
  return best && bestShared * 2 >= cur.count ? best : undefined;
}

export function compareRounds(cur: RoundInsight, prev: RoundInsight, limit = 5): RoundComparison {
  const before = new Map(prev.everyone.map((p) => [p.code, p]));
  const both = cur.everyone.filter((p) => before.has(p.code));
  const rows = both.map((p) => ({ name: p.name, department: p.department, now: p.percent, before: before.get(p.code)!.percent, delta: r1(p.percent - before.get(p.code)!.percent) }));
  const prevDept = new Map(prev.departments.map((d) => [d.name, d.average]));
  return {
    previous: prev,
    averageDelta: r1(cur.average - prev.average),
    departments: cur.departments.map((d) => ({ name: d.name, now: d.average, before: prevDept.get(d.name) ?? null, delta: prevDept.has(d.name) ? r1(d.average - prevDept.get(d.name)!) : null })),
    drops: rows.filter((x) => x.delta <= -DROP_LOOK_POINTS).sort((a, b) => a.delta - b.delta || a.name.localeCompare(b.name, "th")),
    rises: rows.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, "th")).slice(0, limit),
    shared: both.length,
  };
}
