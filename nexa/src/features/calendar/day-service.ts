import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts, LATE_GRACE_MIN } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { teamScopeFilter } from "@/features/employee/service";
import { loadTodayAttendance } from "@/features/attendance-status/service";
import {
  classifyToday,
  excusedUntil,
  hhmmToMin,
  type HourRange,
  type TodayStatus,
} from "@/features/attendance-status/status-rules";
import type { CalendarDayAttendance, CalendarDayCounts } from "./types";

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

/** Same lookback as the dashboard: only people with a clock-in record this recently are checked. */
export const ACTIVITY_LOOKBACK_DAYS = 60;

/**
 * Absent / on leave / late head-counts for every finished working day of a month, for the numbers drawn inside each calendar cell.
 *
 * Same rules and people as the day panel and the attendance dashboard (classifyToday, the same team scope, only people who use
 * the clock-in app, whole-day leave excuses the day, an hour or morning half day moves the start), read once for the month
 * instead of once per day. Weekends, holidays and days still to come get no entry. Today is read as of now.
 */
export async function getMonthAttendanceCounts(
  companyId: string,
  session: AccessClaims,
  month: string,
): Promise<Record<string, CalendarDayCounts>> {
  const [y, mo] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const monthEnd = new Date(Date.UTC(y, mo, 1));
  const bkk = bangkokParts();
  const today = bkk.dateUTC;
  const rangeEnd = new Date(Math.min(monthEnd.getTime(), today.getTime() + DAY_MS));
  if (rangeEnd.getTime() <= start.getTime()) return {};

  const scope = teamScopeFilter(session) ?? {};
  const roster = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", ...scope },
    select: { id: true, employmentType: true },
  });
  if (roster.length === 0) return {};

  const usage = await prisma.attendanceRecord.groupBy({
    by: ["employeeId"],
    where: {
      companyId,
      deletedAt: null,
      workDate: { gte: new Date(start.getTime() - ACTIVITY_LOOKBACK_DAYS * DAY_MS), lt: rangeEnd },
      employee: scope,
    },
  });
  const users = new Set(usage.map((u) => u.employeeId));
  const checked = roster.filter((e) => users.has(e.id));
  if (checked.length === 0) return {};

  const holidays = await prisma.holiday.findMany({
    where: { companyId, deletedAt: null, date: { gte: start, lt: rangeEnd } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, workDate: { gte: start, lt: rangeEnd }, employee: scope },
    select: { employeeId: true, workDate: true, clockInAt: true },
  });
  const clockIn = new Map<string, number>();
  for (const r of records) {
    if (r.clockInAt) clockIn.set(`${r.employeeId}|${r.workDate.toISOString().slice(0, 10)}`, bangkokParts(r.clockInAt).minutesOfDay);
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "APPROVED",
      startDate: { lt: rangeEnd },
      endDate: { gte: start },
      employee: scope,
    },
    select: { employeeId: true, unit: true, halfDay: true, halfDayPeriod: true, startDate: true, endDate: true, startTime: true, endTime: true },
  });
  const shifts = await resolveShiftMinutesBatch(companyId, start, rangeEnd);

  const out: Record<string, CalendarDayCounts> = {};
  for (let cur = new Date(start); cur.getTime() < rangeEnd.getTime(); cur = new Date(cur.getTime() + DAY_MS)) {
    const day = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay();
    if (dow === 0 || dow === 6 || holidaySet.has(day)) continue;
    const nowMin = cur.getTime() === today.getTime() ? bkk.minutesOfDay : 24 * 60;

    const dayLeaves = leaves.filter((l) => l.startDate.getTime() <= cur.getTime() && cur.getTime() <= l.endDate.getTime());
    const wholeDay = new Set(dayLeaves.filter((l) => l.unit === "DAY" && (!l.halfDay || !l.halfDayPeriod)).map((l) => l.employeeId));
    const morningHalf = new Set(dayLeaves.filter((l) => l.unit === "DAY" && l.halfDay && l.halfDayPeriod === "MORNING").map((l) => l.employeeId));
    const hours = new Map<string, HourRange[]>();
    for (const l of dayLeaves) {
      if (l.unit !== "HOUR") continue;
      const a = hhmmToMin(l.startTime);
      const b = hhmmToMin(l.endTime);
      if (a === null || b === null) continue;
      hours.set(l.employeeId, [...(hours.get(l.employeeId) ?? []), { startMin: a, endMin: b }]);
    }

    const counts: CalendarDayCounts = { absent: 0, leave: 0, late: 0 };
    for (const e of checked) {
      const shift = shiftMinutesFromBatch(shifts, e.id, cur, e.employmentType);
      const shiftEnd = shift.endMin <= shift.startMin ? shift.endMin + 24 * 60 : shift.endMin;
      const hourly = excusedUntil(hours.get(e.id) ?? [], shift.startMin);
      const halfStart = morningHalf.has(e.id) ? Math.floor((shift.startMin + shiftEnd) / 2) : null;
      const status: TodayStatus = classifyToday({
        nowMin,
        shiftStartMin: shift.startMin,
        clockInMin: clockIn.get(`${e.id}|${day}`) ?? null,
        onApprovedLeave: wholeDay.has(e.id),
        lateGraceMin: LATE_GRACE_MIN,
        excusedUntilMin: halfStart == null ? hourly : Math.max(hourly ?? 0, halfStart),
      });
      if (status === "ABSENT") counts.absent++;
      else if (status === "ON_LEAVE") counts.leave++;
      else if (status === "LATE") counts.late++;
    }
    out[day] = counts;
  }
  return out;
}
