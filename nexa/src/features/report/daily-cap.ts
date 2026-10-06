/**
 * Row limit for the daily attendance report, without cutting a day in half.
 *
 * `rowsDesc` must be sorted newest date first. When there are more rows than
 * `limit`, the newest `limit` are taken and the oldest day among them is
 * dropped entirely (it may be incomplete), so every day that is shown is shown
 * in full. `truncatedFrom` is then the first day that is fully covered
 * (YYYY-MM-DD), or null when nothing was cut.
 *
 * Pure and dependency-free so it can be checked on its own.
 */
export function capRowsByDay<T extends { dateIso: string }>(
  rowsDesc: T[],
  limit: number,
): { kept: T[]; truncatedFrom: string | null } {
  if (rowsDesc.length <= limit) return { kept: rowsDesc, truncatedFrom: null };
  const boundary = rowsDesc[limit - 1].dateIso;
  // The oldest kept day is complete when the first row that was cut belongs to an older day.
  if (rowsDesc[limit].dateIso !== boundary) {
    return { kept: rowsDesc.slice(0, limit), truncatedFrom: boundary };
  }
  const kept = rowsDesc.filter((r) => r.dateIso > boundary);
  const next = new Date(`${boundary}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { kept, truncatedFrom: next.toISOString().slice(0, 10) };
}

/** The later of two coverage dates (YYYY-MM-DD), ignoring nulls. */
export function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
