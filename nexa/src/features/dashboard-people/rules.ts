/**
 * Pure rules for the people cards on the dashboard (who is on leave, who is
 * near the end of probation, how far an evaluation round has got).
 *
 * No imports on purpose: every date here is a Bangkok calendar day stored as
 * UTC midnight (see `bangkokParts().dateUTC`), so the rules can be checked with
 * `node --experimental-strip-types scripts/check-dashboard-people.mjs`.
 */

export const DAY_MS = 86_400_000;

/** Leave shown from today up to this many days ahead. */
export const LEAVE_LOOKAHEAD_DAYS = 7;
/** Probation ends within this many days from today to be listed. */
export const PROBATION_WINDOW_DAYS = 30;
/**
 * Fallback when HR has not entered a probation end date: the 120th day of work
 * (hire day = day 1). Severance applies from 120 days under Thai labour law,
 * so the evaluation has to be finished before it. HR still owns the real
 * checkpoints; this only keeps the list from being empty.
 */
export const PROBATION_FALLBACK_DAYS = 120;

export type LeaveBucket = "today" | "soon" | null;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Today if the leave covers today, "soon" if it starts within the lookahead, otherwise not shown. */
export function leaveBucket(start: Date, end: Date, today: Date): LeaveBucket {
  if (end.getTime() < today.getTime()) return null;
  if (start.getTime() <= today.getTime()) return "today";
  return daysBetween(today, start) <= LEAVE_LOOKAHEAD_DAYS ? "soon" : null;
}

export interface ProbationDeadline {
  date: Date;
  /** "probation" = the date HR entered, "day120" = worked out from the hire date. */
  source: "probation" | "day120";
}

export function probationDeadline(hireDate: Date | null, probationEndDate: Date | null): ProbationDeadline | null {
  if (probationEndDate) return { date: probationEndDate, source: "probation" };
  if (hireDate) {
    return { date: new Date(hireDate.getTime() + (PROBATION_FALLBACK_DAYS - 1) * DAY_MS), source: "day120" };
  }
  return null;
}

/** Days left until the deadline, or null when it is outside the window (already passed or too far away). */
export function probationDaysLeft(deadline: ProbationDeadline | null, today: Date): number | null {
  if (!deadline) return null;
  const left = daysBetween(today, deadline.date);
  return left >= 0 && left <= PROBATION_WINDOW_DAYS ? left : null;
}

export interface ResponseTally {
  total: number;
  submitted: number;
  inProgress: number;
  pending: number;
  /** Whole percent submitted, 0 when there is nothing to do. */
  percent: number;
}

export function tallyResponses(statuses: readonly ("PENDING" | "IN_PROGRESS" | "SUBMITTED")[]): ResponseTally {
  let submitted = 0;
  let inProgress = 0;
  for (const s of statuses) {
    if (s === "SUBMITTED") submitted++;
    else if (s === "IN_PROGRESS") inProgress++;
  }
  const total = statuses.length;
  return {
    total,
    submitted,
    inProgress,
    pending: total - submitted - inProgress,
    percent: total > 0 ? Math.round((submitted / total) * 100) : 0,
  };
}
