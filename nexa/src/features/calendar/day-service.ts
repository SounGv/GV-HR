import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { loadTodayAttendance } from "@/features/attendance-status/service";
import type { TodayStatus } from "@/features/attendance-status/status-rules";
import type { CalendarDayAttendance } from "./types";

const DAY_MS = 86_400_000;

/**
 * Who was absent, on leave or late on one calendar day, for the day panel.
 *
 * Reuses the dashboard's own rules (loadTodayAttendance) read as of the end of that Bangkok day, so the calendar can never
 * disagree with the attendance overview. A future day has nothing to count yet and is returned as such; the screen shows the
 * leave already approved from the month list instead.
 *
 * Leave type is left out on purpose: sick leave is health data, and the calendar does not show it either.
 */
export async function getDayAttendance(
  companyId: string,
  session: AccessClaims,
  dateIso: string,
): Promise<CalendarDayAttendance> {
  const todayIso = bangkokParts().dateUTC.toISOString().slice(0, 10);
  if (dateIso > todayIso) {
    return { dateIso, isFuture: true, isWorkingDay: true, nonWorkingReason: null, total: 0, notChecked: 0, counts: emptyCounts(), people: [] };
  }
  // 23:59:59 Bangkok on that day, so nobody is still "not yet" on a finished day.
  const asOf = dateIso === todayIso ? new Date() : new Date(new Date(`${dateIso}T00:00:00.000Z`).getTime() + DAY_MS - 7 * 3_600_000 - 1000);
  const day = await loadTodayAttendance(companyId, session, undefined, asOf);
  return {
    dateIso,
    isFuture: false,
    isWorkingDay: day.isWorkingDay,
    nonWorkingReason: day.nonWorkingReason,
    total: day.total,
    notChecked: day.notChecked,
    counts: day.counts,
    people: day.people
      .filter((p) => p.status !== "NORMAL" || !!p.leaveNote)
      .map((p) => ({
        employeeId: p.employeeId,
        name: p.name,
        department: p.department,
        status: p.status,
        clockIn: p.clockIn,
        lateMinutes: p.lateMinutes,
        partialLeave: p.status !== "ON_LEAVE" && !!p.leaveNote,
      })),
  };
}

function emptyCounts(): Record<TodayStatus, number> {
  return { NORMAL: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_YET: 0 };
}
