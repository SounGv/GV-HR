/** Pure date rules for scheduled rounds (no imports, so scripts/check-evaluation-fixes.mjs can run them). */

/** Cycle label from a Bangkok calendar year (C.E.) and month (1-12). */
export function formatCycleLabel(year: number, month: number, intervalMonths: number): string {
  const beYear = year + 543;
  if (intervalMonths >= 12) return `ประจำปี ${beYear}`;
  if (intervalMonths >= 6) return `ครึ่งปี ${month <= 6 ? 1 : 2}/${beYear}`;
  if (intervalMonths >= 3) return `ไตรมาส ${Math.floor((month - 1) / 3) + 1}/${beYear}`;
  return `เดือน ${month}/${beYear}`;
}

/** Adds whole months to a UTC-midnight date, clamping the day (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
export function addMonthsClamped(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}
