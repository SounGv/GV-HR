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
  };
}
