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
  /**
   * End of an approved hourly leave that covers the shift start (see `excusedUntil`): the person is excused until then, so the
   * late and absent clocks start there instead of at the shift start.
   */
  excusedUntilMin?: number | null;
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
  // An hour of approved leave at the start of the shift moves the start: arriving inside it is not late.
  const start = Math.max(i.shiftStartMin, i.excusedUntilMin ?? 0);
  if (i.clockInMin == null) {
    if (i.onApprovedLeave) return "ON_LEAVE";
    return i.nowMin < start + absentAfter ? "NOT_YET" : "ABSENT";
  }
  if (i.onApprovedLeave) return "NORMAL";
  return i.clockInMin > start + i.lateGraceMin ? "LATE" : "NORMAL";
}

/**
 * Someone who came in but took part of the day as leave (an hour, or half a day): they are counted as on time or late by their scan,
 * and also listed under leave so HR can see the leave beside them.
 */
export const hasPartialLeave = (p: { status: string; leaveNote: string | null }) => p.status !== "ON_LEAVE" && !!p.leaveNote;

export interface HourRange {
  startMin: number;
  endMin: number;
}

/** "HH:mm" as minutes since midnight, or null when it is not a time. */
export function hhmmToMin(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h > 23 || mm > 59 ? null : h * 60 + mm;
}

/**
 * Until when an approved hourly leave excuses the person from the start of the shift: the end of the leave that covers the shift
 * start, extended through any leave that begins where the last one ends (09:00-10:00 then 10:00-11:00 excuses until 11:00).
 * A leave in the middle of the day does not touch arrival, so it returns null.
 */
export function excusedUntil(leaves: readonly HourRange[], shiftStartMin: number): number | null {
  let until: number | null = null;
  let reach = shiftStartMin;
  const sorted = [...leaves].filter((l) => l.endMin > l.startMin).sort((a, b) => a.startMin - b.startMin);
  for (const l of sorted) {
    if (l.startMin <= reach && l.endMin > reach) {
      until = l.endMin;
      reach = l.endMin;
    }
  }
  return until;
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
