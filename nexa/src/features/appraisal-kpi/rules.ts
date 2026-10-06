/**
 * Pure rules for KPI profiles: numbers the system already has (late days, leave, OT, ...) turned into a score
 * with step tables HR writes (no imports; checked by `node --experimental-strip-types scripts/check-appraisal-kpi.mjs`).
 *
 * Nothing here is a policy: which metrics count, their weights, the steps and the bands all come from the profile HR saves.
 */

export interface Metric {
  key: string;
  label: string;
  unit: string;
  /** true when a bigger number is better (e.g. attendance rate); otherwise a smaller number is better. */
  higherBetter: boolean;
}

/** The columns of the attendance summary report that can be used as a KPI. */
export const METRICS: readonly Metric[] = [
  { key: "late", label: "จำนวนวันมาสาย", unit: "วัน", higherBetter: false },
  { key: "absent", label: "จำนวนวันขาดงาน", unit: "วัน", higherBetter: false },
  { key: "earlyLeave", label: "จำนวนวันออกก่อนเวลา", unit: "วัน", higherBetter: false },
  { key: "noClockOut", label: "จำนวนวันไม่ลงเวลาออก", unit: "วัน", higherBetter: false },
  { key: "sick", label: "วันลาป่วย", unit: "วัน", higherBetter: false },
  { key: "personal", label: "วันลากิจ", unit: "วัน", higherBetter: false },
  { key: "annual", label: "วันลาพักร้อน", unit: "วัน", higherBetter: false },
  { key: "unpaidOther", label: "วันลาไม่รับค่าจ้างและอื่นๆ", unit: "วัน", higherBetter: false },
  { key: "otHours", label: "ชั่วโมง OT", unit: "ชม.", higherBetter: false },
  { key: "rate", label: "อัตราการมาทำงาน", unit: "%", higherBetter: true },
];

export const metricOf = (key: string): Metric | undefined => METRICS.find((m) => m.key === key);

/** "A value up to `limit` earns `points` percent of the indicator's weight" (or "from `limit` up" when higher is better). */
export interface Step {
  limit: number;
  /** 0 to 100: the share of the indicator's weight this step earns. */
  points: number;
}

export interface Indicator {
  metric: string;
  /** Share of the total score; all indicators together must be 100. */
  weight: number;
  steps: Step[];
}

export interface KpiBand {
  label: string;
  /** Lowest total score (0-100) for this band. */
  min: number;
  tone: "green" | "yellow" | "red" | "black";
}

/** Points earned by one value. The first step that fits wins; a value beyond every step earns 0. */
export function indicatorPoints(steps: readonly Step[], value: number, higherBetter: boolean): number {
  const ordered = [...steps].sort((a, b) => (higherBetter ? b.limit - a.limit : a.limit - b.limit));
  const hit = ordered.find((s) => (higherBetter ? value >= s.limit : value <= s.limit));
  return hit ? hit.points : 0;
}

export interface KpiPart {
  metric: string;
  value: number;
  points: number;
  weight: number;
}

export interface KpiResult {
  score: number;
  parts: KpiPart[];
}

/** Total score 0-100 for one person: each indicator's points scaled by its weight. Unknown metrics are skipped. */
export function kpiScore(indicators: readonly Indicator[], values: Readonly<Record<string, number>>): KpiResult {
  const parts: KpiPart[] = [];
  let total = 0;
  for (const ind of indicators) {
    const m = metricOf(ind.metric);
    if (!m) continue;
    const value = values[ind.metric] ?? 0;
    const points = indicatorPoints(ind.steps, value, m.higherBetter);
    total += (ind.weight * points) / 100;
    parts.push({ metric: ind.metric, value, points, weight: ind.weight });
  }
  return { score: Math.round(total * 10) / 10, parts };
}

/** The highest band the score reaches, or null. */
export function bandFor(score: number, bands: readonly KpiBand[]): KpiBand | null {
  return [...bands].sort((a, b) => b.min - a.min).find((b) => score >= b.min) ?? null;
}

/** What stops a profile from being saved, in words HR can act on (empty = fine). */
export function profileProblems(indicators: readonly Indicator[], bands: readonly KpiBand[]): string[] {
  const out: string[] = [];
  if (indicators.length === 0) out.push("ยังไม่ได้เลือกตัวชี้วัด");
  const total = indicators.reduce((s, i) => s + i.weight, 0);
  if (indicators.length > 0 && total !== 100) out.push(`น้ำหนักรวม ${total} ต้องเป็น 100`);
  const seen = new Set<string>();
  indicators.forEach((i, n) => {
    if (!metricOf(i.metric)) out.push(`ตัวชี้วัดที่ ${n + 1} ไม่ถูกต้อง`);
    if (seen.has(i.metric)) out.push(`ตัวชี้วัดซ้ำ: ${metricOf(i.metric)?.label ?? i.metric}`);
    seen.add(i.metric);
    if (i.steps.length === 0) out.push(`ตัวชี้วัดที่ ${n + 1} ยังไม่มีเกณฑ์ให้คะแนน`);
    if (i.steps.some((s) => !(s.points >= 0 && s.points <= 100))) out.push(`ตัวชี้วัดที่ ${n + 1} มีคะแนนนอกช่วง 0–100`);
  });
  if (bands.some((b) => !b.label.trim() || !(b.min >= 0 && b.min <= 100))) out.push("ระดับสีต้องมีชื่อและคะแนนขั้นต่ำ 0–100");
  return out;
}
