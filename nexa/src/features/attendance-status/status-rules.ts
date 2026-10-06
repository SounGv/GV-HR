/**
 * Rules for the attendance overview on the dashboard. Pure and free of imports
 * so they can be checked on their own.
 *
 * THE NUMBERS BELOW ARE EXAMPLES TAKEN FROM THE DESIGN BRIEF, NOT AGREED
 * COMPANY POLICY. HR must confirm them before they are relied on; they are named
 * constants so changing one is a one-line edit.
 */

/** Minutes after the shift start with no scan before "not yet" turns into "absent". */
export const ABSENT_AFTER_SHIFT_START_MIN = 30;

/** Watch list (last 30 days): a person is listed when any of these is reached. */
export const WATCH_LATE_COUNT = 5;
export const WATCH_ABSENT_DAYS = 2;
export const WATCH_LEAVE_COUNT = 4;
export const WATCH_WINDOW_DAYS = 30;

export type TodayStatus = "NORMAL" | "LATE" | "ABSENT" | "ON_LEAVE" | "NOT_YET";

export interface ClassifyTodayInput {
  /** Minutes since midnight, Bangkok time. */
  nowMin: number;
  shiftStartMin: number;
  /** Clock-in as minutes since midnight Bangkok time, or null when there is no scan. */
  clockInMin: number | null;
  /** An approved full-day leave covers today. */
  onApprovedLeave: boolean;
  lateGraceMin: number;
  absentAfterMin?: number;
}

/**
 * Today's status for one person who is expected to clock in.
 *
 * - approved leave and no scan  -> ON_LEAVE
 * - scanned                     -> LATE after shift start + grace, otherwise NORMAL
 *   (a scan on a leave day is a half-day worker and is not counted late, the
 *   same way payroll and the monthly report treat it)
 * - not scanned                 -> NOT_YET until shift start + absentAfterMin, then ABSENT
 */
export function classifyToday(i: ClassifyTodayInput): TodayStatus {
  const absentAfter = i.absentAfterMin ?? ABSENT_AFTER_SHIFT_START_MIN;
  if (i.clockInMin == null) {
    if (i.onApprovedLeave) return "ON_LEAVE";
    return i.nowMin < i.shiftStartMin + absentAfter ? "NOT_YET" : "ABSENT";
  }
  if (i.onApprovedLeave) return "NORMAL";
  return i.clockInMin > i.shiftStartMin + i.lateGraceMin ? "LATE" : "NORMAL";
}

export interface WatchCounts {
  late: number;
  absent: number;
  /** Leave that counts toward "frequent leave" (not sick leave). */
  leave: number;
}

/** Which of the three criteria a person reaches (empty = not on the list). */
export function watchReasons(c: WatchCounts): ("late" | "absent" | "leave")[] {
  const reasons: ("late" | "absent" | "leave")[] = [];
  if (c.late >= WATCH_LATE_COUNT) reasons.push("late");
  if (c.absent >= WATCH_ABSENT_DAYS) reasons.push("absent");
  if (c.leave >= WATCH_LEAVE_COUNT) reasons.push("leave");
  return reasons;
}

/** Ordering score for the watch list: absence weighs most, then lateness, then leave. */
export function watchScore(c: WatchCounts): number {
  return c.absent * 3 + c.late * 2 + c.leave * 1;
}
