import { displayName } from "@/lib/format";
import { unstable_cache } from "next/cache";
import { attendanceWatchTag } from "./watch-cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts, LATE_GRACE_MIN } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { teamScopeFilter } from "@/features/employee/service";
import { getReport } from "@/features/report/service";
import { WORK_MODE_LABEL } from "@/features/attendance/status-badge";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";
import { avatarPaths } from "@/lib/avatar-server";
import {
  WATCH_WINDOW_DAYS,
  classifyToday,
  excusedUntil,
  hhmmToMin,
  type HourRange,
  watchReasons,
  watchScore,
  type TodayStatus,
} from "./status-rules";
import type {
  AttendanceWatch,
  DepartmentOption,
  DepartmentWatch,
  TodayAttendance,
  TodayPerson,
  WatchPerson,
} from "./types";

const DAY_MS = 86_400_000;
/** Same lookback the daily report uses: only people with a clock-in record this recently are checked. */
const ACTIVITY_LOOKBACK_DAYS = 60;

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Who the caller may look at, narrowed to the chosen departments. */
function employeeScope(session: AccessClaims, departmentIds?: string[]): Prisma.EmployeeWhereInput {
  return {
    ...(departmentIds && departmentIds.length ? { departmentId: { in: departmentIds } } : {}),
    ...(teamScopeFilter(session) ?? {}),
  };
}

/** Departments to choose from in the dashboard filter. */
export async function listDepartmentOptions(companyId: string): Promise<DepartmentOption[]> {
  return prisma.department.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Who is in, late, absent or on leave right now (Bangkok time).
 *
 * Read-only. Sequential queries only (connection_limit=1). Only ACTIVE employees
 * inside the caller's team scope who use the clock-in app (a record in the last
 * ACTIVITY_LOOKBACK_DAYS) are checked, the same rule as the daily report; the
 * rest are only counted in `notChecked` so nobody is called absent for never
 * having used the app. Photos and coordinates are deliberately not read.
 */
export async function loadTodayAttendance(
  companyId: string,
  session: AccessClaims,
  departmentIds?: string[],
  /** The moment to read the day for; always now except in checks. */
  asOf: Date = new Date(),
): Promise<TodayAttendance> {
  const bkk = bangkokParts(asOf);
  const today = bkk.dateUTC;
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const dateIso = today.toISOString().slice(0, 10);
  const counts: Record<TodayStatus, number> = { NORMAL: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0, NOT_YET: 0 };

  const holiday = await prisma.holiday.findFirst({
    where: { companyId, deletedAt: null, date: today },
    select: { name: true },
  });
  const dow = today.getUTCDay();
  const nonWorkingReason = holiday ? `วันหยุด: ${holiday.name}` : dow === 0 || dow === 6 ? "วันหยุดสุดสัปดาห์" : null;
  const empty: TodayAttendance = {
    asOf: hhmm(bkk.minutesOfDay),
    dateIso,
    isWorkingDay: nonWorkingReason === null,
    nonWorkingReason,
    counts,
    total: 0,
    scanned: 0,
    notChecked: 0,
    people: [],
  };

  const scope = employeeScope(session, departmentIds);
  const roster = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", ...scope },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      nickname: true,
      gender: true,
      employmentType: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  if (roster.length === 0) return empty;

  const usage = await prisma.attendanceRecord.groupBy({
    by: ["employeeId"],
    where: {
      companyId,
      deletedAt: null,
      workDate: { gte: new Date(today.getTime() - ACTIVITY_LOOKBACK_DAYS * DAY_MS), lt: tomorrow },
      employee: scope,
    },
  });
  const users = new Set(usage.map((u) => u.employeeId));
  const checked = roster.filter((e) => users.has(e.id));
  const notChecked = roster.length - checked.length;
  // A Saturday is not counted as a working day (no schedule says who must come), but people do work it: say what happened.
  if (nonWorkingReason === "วันหยุดสุดสัปดาห์" && dow === 6 && checked.length > 0) {
    const satRecords = await prisma.attendanceRecord.findMany({
      where: { companyId, deletedAt: null, workDate: today, employeeId: { in: checked.map((e) => e.id) } },
      select: { employeeId: true, clockInAt: true },
    });
    const satLeaves = await prisma.leaveRequest.findMany({
      where: { companyId, deletedAt: null, status: "APPROVED", unit: "DAY", startDate: { lte: today }, endDate: { gte: today }, employeeId: { in: checked.map((e) => e.id) } },
      select: { employeeId: true },
    });
    const leaveIds = new Set(satLeaves.map((l) => l.employeeId));
    const satShifts = await resolveShiftMinutesBatch(companyId, today, tomorrow);
    let satLate = 0;
    for (const r of satRecords) {
      if (!r.clockInAt || leaveIds.has(r.employeeId)) continue;
      const e = checked.find((x) => x.id === r.employeeId);
      if (!e) continue;
      const shift = shiftMinutesFromBatch(satShifts, e.id, today, e.employmentType);
      if (classifyToday({ nowMin: 24 * 60, shiftStartMin: shift.startMin, clockInMin: bangkokParts(r.clockInAt).minutesOfDay, onApprovedLeave: false, lateGraceMin: LATE_GRACE_MIN }) === "LATE") satLate++;
    }
    const scannedCount = satRecords.filter((r) => r.clockInAt).length;
    return { ...empty, notChecked, total: checked.length, weekendActivity: { scanned: scannedCount, late: satLate, onLeave: leaveIds.size } };
  }
  if (nonWorkingReason || checked.length === 0) return { ...empty, notChecked, total: checked.length };

  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, workDate: today, employee: scope },
    select: { employeeId: true, clockInAt: true, workMode: true },
  });
  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "APPROVED",
      unit: "DAY",
      startDate: { lte: today },
      endDate: { gte: today },
      employee: scope,
    },
    select: { employeeId: true, type: true, halfDay: true, halfDayPeriod: true },
  });
  const onLeave = new Set(leaves.map((l) => l.employeeId));
  // Approved leave taken by the hour (e.g. 09:00-10:00): arriving inside it is not late, see excusedUntil.
  const hourLeaves = await prisma.leaveRequest.findMany({
    where: { companyId, deletedAt: null, status: "APPROVED", unit: "HOUR", startDate: { lte: today }, endDate: { gte: today }, employee: scope },
    select: { employeeId: true, type: true, startTime: true, endTime: true },
  });
  const leaveNoteByEmployee = new Map<string, string[]>();
  const noteFor = (employeeId: string, note: string) => leaveNoteByEmployee.set(employeeId, [...(leaveNoteByEmployee.get(employeeId) ?? []), note]);
  for (const l of leaves) {
    if (l.halfDay) noteFor(l.employeeId, `${LEAVE_TYPE_LABEL[l.type] ?? l.type}ครึ่งวัน${l.halfDayPeriod === "MORNING" ? "เช้า" : l.halfDayPeriod === "AFTERNOON" ? "บ่าย" : ""}`);
  }
  // Earliest first, so the note reads in clock order whatever order the requests were made in.
  for (const l of [...hourLeaves].sort((a, b) => (hhmmToMin(a.startTime) ?? 0) - (hhmmToMin(b.startTime) ?? 0))) {
    if (l.startTime && l.endTime) noteFor(l.employeeId, `${LEAVE_TYPE_LABEL[l.type] ?? l.type} ${l.startTime}-${l.endTime}`);
  }
  const hourRangesByEmployee = new Map<string, HourRange[]>();
  for (const l of hourLeaves) {
    const startMin = hhmmToMin(l.startTime);
    const endMin = hhmmToMin(l.endTime);
    if (startMin === null || endMin === null) continue;
    hourRangesByEmployee.set(l.employeeId, [...(hourRangesByEmployee.get(l.employeeId) ?? []), { startMin, endMin }]);
  }
  // Leave type shown beside the name; a person with two overlapping requests shows each type once.
  const leaveTypeByEmployee = new Map<string, string[]>();
  for (const l of leaves) {
    const label = LEAVE_TYPE_LABEL[l.type] ?? l.type;
    const list = leaveTypeByEmployee.get(l.employeeId) ?? [];
    if (!list.includes(label)) list.push(label);
    leaveTypeByEmployee.set(l.employeeId, list);
  }
  const shiftMap = await resolveShiftMinutesBatch(companyId, today, tomorrow);

  // Photos: one light lookup (length + tail of each stored photo), never the photos themselves.
  const photos = await avatarPaths(checked.map((e) => e.id));
  const people: TodayPerson[] = checked.map((e) => {
    const rec = recordByEmployee.get(e.id);
    const clockInMin = rec?.clockInAt ? bangkokParts(rec.clockInAt).minutesOfDay : null;
    const shift = shiftMinutesFromBatch(shiftMap, e.id, today, e.employmentType);
    const excusedUntilMin = excusedUntil(hourRangesByEmployee.get(e.id) ?? [], shift.startMin);
    const status = classifyToday({
      nowMin: bkk.minutesOfDay,
      shiftStartMin: shift.startMin,
      clockInMin,
      onApprovedLeave: onLeave.has(e.id),
      lateGraceMin: LATE_GRACE_MIN,
      excusedUntilMin,
    });
    counts[status]++;
    return {
      employeeId: e.id,
      gender: e.gender ?? null,
      avatarUrl: photos.get(e.id) ?? null,
      code: e.employeeCode,
      name: displayName(e),
      department: e.department?.name ?? "ไม่มีแผนก",
      departmentId: e.departmentId,
      status,
      clockIn: clockInMin == null ? null : hhmm(clockInMin),
      shiftStart: hhmm(shift.startMin),
      lateMinutes: status === "LATE" && clockInMin != null ? clockInMin - Math.max(shift.startMin, excusedUntilMin ?? 0) : null,
      workMode: rec?.clockInAt ? (WORK_MODE_LABEL[rec.workMode] ?? null) : null,
      leaveType: status === "ON_LEAVE" ? (leaveTypeByEmployee.get(e.id)?.join(" / ") ?? null) : null,
      leaveNote: status === "ON_LEAVE" ? null : (leaveNoteByEmployee.get(e.id)?.join(", ") ?? null),
    };
  });

  return {
    ...empty,
    counts,
    total: people.length,
    scanned: people.filter((p) => p.clockIn !== null).length,
    notChecked,
    people,
  };
}

/** Leave that counts toward "frequent leave": personal and unpaid. Sick leave is health data and is never counted. */
const COUNTED_LEAVE_NOTES = [LEAVE_TYPE_LABEL.PERSONAL, LEAVE_TYPE_LABEL.UNPAID];

/**
 * People who reached a late / absent / leave threshold in the last WATCH_WINDOW_DAYS days.
 *
 * Built from the daily attendance report itself (same late rule against each
 * person's real shift, same absent rule, same team scope) so the dashboard
 * can never disagree with the report. Leave is counted only for full days with no
 * scan, which understates half-day leave.
 */
export async function loadAttendanceWatch(
  companyId: string,
  session: AccessClaims,
  departmentIds?: string[],
): Promise<AttendanceWatch> {
  const today = bangkokParts().dateUTC;
  const from = new Date(today.getTime() - (WATCH_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const report = await getReport(companyId, {
    type: "attendance_daily",
    from,
    to,
    ...(departmentIds && departmentIds.length ? { departmentId: departmentIds } : {}),
    employeeWhere: teamScopeFilter(session) ?? undefined,
    // The watch list only ever reads code/name/department/statusKey/note
    // (see the row loop below) — never who edited a record or approved OT.
    includeNames: false,
  });

  const byPerson = new Map<string, WatchPerson>();
  const deptStats = new Map<string, { codes: Set<string>; late: number; absent: number }>();
  for (const row of report.rows) {
    const code = String(row.code);
    const department = String(row.department);
    const person =
      byPerson.get(code) ??
      ({ code, name: String(row.name), department, late: 0, absent: 0, leave: 0, reasons: [], score: 0 } as WatchPerson);
    const dept = deptStats.get(department) ?? { codes: new Set<string>(), late: 0, absent: 0 };
    dept.codes.add(code);
    if (row.statusKey === "LATE") {
      person.late++;
      dept.late++;
    } else if (row.statusKey === "ABSENT") {
      person.absent++;
      dept.absent++;
    } else if (row.statusKey === "ON_LEAVE" && COUNTED_LEAVE_NOTES.some((n) => String(row.note).startsWith(n))) {
      person.leave++;
    }
    byPerson.set(code, person);
    deptStats.set(department, dept);
  }

  const people = [...byPerson.values()]
    .map((p) => ({ ...p, reasons: watchReasons(p), score: watchScore(p) }))
    .filter((p) => p.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "th"));
  // The report rows carry no gender; one lookup by code gives each person their character avatar.
  if (people.length > 0) {
    const genders = await prisma.employee.findMany({
      where: { companyId, deletedAt: null, employeeCode: { in: people.map((p) => p.code) } },
      select: { id: true, employeeCode: true, gender: true },
    });
    const byCode = new Map(genders.map((g) => [g.employeeCode, g]));
    const photos = await avatarPaths(genders.map((g) => g.id));
    for (const p of people) {
      const found = byCode.get(p.code);
      p.employeeId = found?.id;
      p.gender = found?.gender ?? null;
      p.avatarUrl = found ? (photos.get(found.id) ?? null) : null;
    }
  }

  const departments: DepartmentWatch[] = [...deptStats.entries()]
    .map(([department, d]) => ({
      department,
      people: d.codes.size,
      late: d.late,
      absent: d.absent,
      perPerson: d.codes.size ? (d.late + d.absent) / d.codes.size : 0,
    }))
    .filter((d) => d.late + d.absent > 0)
    .sort((a, b) => b.perPerson - a.perPerson);

  return { windowDays: WATCH_WINDOW_DAYS, people, departments, truncatedFrom: report.truncatedFrom ?? null };
}

/** How long a user's watch list is reused. It is a 30-day tally, so a few minutes of delay changes nothing HR would act on. */
const WATCH_CACHE_SECONDS = 300;

/**
 * Who the cached watch list belongs to. It follows the viewer's team scope, so the key must change when the scope
 * does: everyone who sees the whole company shares one entry ("company"), and a manager whose view is limited to the
 * people under them gets their own. Keying on every user (as before) rebuilt the same company-wide 30-day report once
 * per person, and again for all of them every time a leave was approved and the tag dropped the cache (13 to 15 Nov 2026:
 * database connections closed, pool timeouts, out-of-memory kills on the dashboard).
 */
export function watchCacheScope(session: AccessClaims): string {
  return teamScopeFilter(session) === null ? "company" : `team:${session.sub}`;
}

/** Builds in progress on this server instance, so a burst of views after the cache drops runs the report once. */
const watchBuilds = new Map<string, Promise<AttendanceWatch>>();

function buildOnce(key: string, build: () => Promise<AttendanceWatch>): Promise<AttendanceWatch> {
  const running = watchBuilds.get(key);
  if (running) return running;
  const started = build().finally(() => watchBuilds.delete(key));
  watchBuilds.set(key, started);
  return started;
}

/**
 * `loadAttendanceWatch` remembered for a few minutes, once per viewing scope and department filter (see
 * `watchCacheScope`). It rebuilds the whole 30-day daily report, which was the slowest part of opening the dashboard.
 */
export function loadAttendanceWatchCached(
  companyId: string,
  session: AccessClaims,
  departmentIds: string[] = [],
): Promise<AttendanceWatch> {
  const scope = watchCacheScope(session);
  const depts = [...departmentIds].sort().join(",");
  return unstable_cache(
    () => buildOnce(`${companyId}|${scope}|${depts}`, () => loadAttendanceWatch(companyId, session, departmentIds)),
    ["attendance-watch", companyId, scope, depts],
    { revalidate: WATCH_CACHE_SECONDS, tags: [attendanceWatchTag(companyId)] },
  )();
}

export interface EmployeeAttendanceSummary {
  code: string;
  name: string;
  department: string;
  windowDays: number;
  present: number;
  late: number;
  absent: number;
  /** Leave counted toward "frequent leave" (personal and unpaid; never sick leave). */
  leave: number;
  /** Latest days first. Only status, scan time and minutes late: no photo, no location. */
  recent: { date: string; statusKey: string; clockIn: string; lateMinutes: number | null }[];
  truncatedFrom: string | null;
}

/**
 * Last WATCH_WINDOW_DAYS days for one person, for the side panel. Same source
 * and team scope as the watch list; returns null when the person is not
 * visible to the caller.
 */
export async function loadEmployeeAttendanceSummary(
  companyId: string,
  session: AccessClaims,
  code: string,
): Promise<EmployeeAttendanceSummary | null> {
  const scope = teamScopeFilter(session);
  const emp = await prisma.employee.findFirst({
    where: { companyId, deletedAt: null, employeeCode: code, ...(scope ?? {}) },
    select: { id: true, firstName: true, lastName: true, nickname: true, department: { select: { name: true } } },
  });
  if (!emp) return null;
  const today = bangkokParts().dateUTC;
  const report = await getReport(companyId, {
    type: "attendance_daily",
    from: new Date(today.getTime() - (WATCH_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    employeeId: [emp.id],
    employeeWhere: scope ?? undefined,
    // This side panel only reads statusKey/note/date/clockIn/lateMinutes below.
    includeNames: false,
  });
  let present = 0;
  let late = 0;
  let absent = 0;
  let leave = 0;
  for (const row of report.rows) {
    if (row.statusKey === "PRESENT") present++;
    else if (row.statusKey === "LATE") late++;
    else if (row.statusKey === "ABSENT") absent++;
    else if (row.statusKey === "ON_LEAVE" && COUNTED_LEAVE_NOTES.some((n) => String(row.note).startsWith(n))) leave++;
  }
  return {
    code,
    name: displayName(emp),
    department: emp.department?.name ?? "ไม่มีแผนก",
    windowDays: WATCH_WINDOW_DAYS,
    present,
    late,
    absent,
    leave,
    recent: report.rows.slice(0, 10).map((r) => ({
      date: String(r.date),
      statusKey: String(r.statusKey),
      clockIn: String(r.clockIn),
      lateMinutes: typeof r.lateMinutes === "number" ? r.lateMinutes : null,
    })),
    truncatedFrom: report.truncatedFrom ?? null,
  };
}
