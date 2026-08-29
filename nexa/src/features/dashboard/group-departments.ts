export interface DeptDatum {
  name: string;
  count: number;
}

/**
 * Keep the top `n` departments distinguishable and fold everything past that
 * into a single "อื่นๆ" bucket — a flat 19-row legend/donut is unreadable
 * (many tiny 1-2% slices, colors repeating). Only applies once there's
 * actually a long tail to fold. Plain function (no "use client") so it can
 * run in the server-rendered dashboard page. n=8 matches the validated
 * categorical palette's slot count (dashboard-charts.tsx) — a 9th real
 * category is never a generated hue, it folds into "Other" instead.
 */
export function groupTopDepartments(data: DeptDatum[], n = 8): DeptDatum[] {
  if (data.length <= n) return data;
  const top = data.slice(0, n);
  const otherCount = data.slice(n).reduce((s, d) => s + d.count, 0);
  return [...top, { name: "อื่นๆ", count: otherCount }];
}
