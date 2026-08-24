/** True once `asOf` is at least one full year past `hireDate` (calendar-year
 * anniversary, not a flat 365-day count — matches how tenure is normally
 * meant in HR policy, including leap years). Shared by every benefit that
 * gates on "worked 1 year" (medical expense cap, company loan). */
export function hasCompletedOneYear(hireDate: Date, asOf: Date): boolean {
  const anniversary = new Date(hireDate);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return asOf >= anniversary;
}

/** True if probation is over (or the employee was never on probation at all). */
export function hasPassedProbation(probationEndDate: Date | null, asOf: Date): boolean {
  return !probationEndDate || probationEndDate <= asOf;
}
