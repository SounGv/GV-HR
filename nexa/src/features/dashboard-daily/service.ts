import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { displayName } from "@/lib/format";
import { teamScopeFilter } from "@/features/employee/service";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";

const DAY_MS = 86_400_000;
/** How far back the "forgot to scan out" card looks (today is never included: people are still at work). */
export const MISSED_SCAN_OUT_DAYS = 7;
/** Rows read per card at most; the card says when there are more. */
const ROW_CAP = 60;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clock = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(d);

const employeeSelect = {
  id: true,
  gender: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  nickname: true,
  department: { select: { name: true } },
} as const;

export interface MissedScanOut {
  recordId: string;
  employeeId: string;
  gender: string | null;
  name: string;
  department: string;
  /** Bangkok calendar day of the shift (YYYY-MM-DD). */
  dayIso: string;
  /** HH:mm of the scan-in. */
  clockIn: string;
  /** HH:mm of the scan-out, "-" when there is none. */
  clockOut: string;
  /** HH:mm the shift starts that day. */
  shiftStart: string;
}

/** A first scan this long after the shift start most likely means the morning scan was forgotten. */
export const LATE_FIRST_SCAN_MIN = 240;

export interface MissedScans {
  days: number;
  /** Scanned in, never scanned out. */
  noClockOut: MissedScanOut[];
  /** First scan of the day 4+ hours after the shift start, on a day with no approved leave. */
  lateFirstScan: MissedScanOut[];
  /** Scan-out earlier than scan-in: a broken record that needs fixing. */
  outBeforeIn: MissedScanOut[];
}

const bkkMinutes = (d: Date) => ((d.getUTCHours() + 7) % 24) * 60 + d.getUTCMinutes();
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Scans that need a time fix on one of the last {@link MISSED_SCAN_OUT_DAYS}
 * days (today is never included: people are still at work), newest first, for
 * the people the caller may see. Three kinds (owner, 13 Nov 2026: a forgotten
 * morning scan used to show up only as "สาย"): no scan-out; first scan
 * {@link LATE_FIRST_SCAN_MIN}+ minutes after the shift start with no approved
 * leave that day; scan-out before scan-in.
 *
 * @param companyId Company of the caller.
 * @param session Caller; narrows to their own team unless company-wide.
 */
export async function loadMissedScans(companyId: string, session: AccessClaims): Promise<MissedScans> {
  const today = bangkokParts().dateUTC;
  const from = new Date(today.getTime() - MISSED_SCAN_OUT_DAYS * DAY_MS);
  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      deletedAt: null,
      workDate: { gte: from, lt: today },
      clockInAt: { not: null },
      employee: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...(teamScopeFilter(session) ?? {}) },
    },
    select: { id: true, workDate: true, clockInAt: true, clockOutAt: true, employee: { select: { ...employeeSelect, employmentType: true } } },
    orderBy: [{ workDate: "desc" }, { clockInAt: "asc" }],
  });
  const shiftMap = await resolveShiftMinutesBatch(companyId, from, today);
  const leaves = await prisma.leaveRequest.findMany({
    where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: today }, endDate: { gte: from } },
    select: { employeeId: true, startDate: true, endDate: true },
  });
  const onLeave = (employeeId: string, day: Date) =>
    leaves.some((l) => l.employeeId === employeeId && l.startDate.getTime() <= day.getTime() && day.getTime() <= l.endDate.getTime());

  const out: MissedScans = { days: MISSED_SCAN_OUT_DAYS, noClockOut: [], lateFirstScan: [], outBeforeIn: [] };
  for (const r of records) {
    if (!r.clockInAt) continue;
    const shift = shiftMinutesFromBatch(shiftMap, r.employee.id, r.workDate, r.employee.employmentType);
    const row: MissedScanOut = {
      recordId: r.id,
      employeeId: r.employee.id,
      gender: r.employee.gender ?? null,
      name: displayName(r.employee),
      department: r.employee.department?.name ?? "ไม่ระบุแผนก",
      dayIso: iso(r.workDate),
      clockIn: clock(r.clockInAt),
      clockOut: r.clockOutAt ? clock(r.clockOutAt) : "-",
      shiftStart: hhmm(shift.startMin),
    };
    if (!r.clockOutAt) out.noClockOut.push(row);
    else if (r.clockOutAt.getTime() < r.clockInAt.getTime()) out.outBeforeIn.push(row);
    else if (bkkMinutes(r.clockInAt) - shift.startMin >= LATE_FIRST_SCAN_MIN && !onLeave(r.employee.id, r.workDate)) out.lateFirstScan.push(row);
  }
  return {
    days: out.days,
    noClockOut: out.noClockOut.slice(0, ROW_CAP),
    lateFirstScan: out.lateFirstScan.slice(0, ROW_CAP),
    outBeforeIn: out.outBeforeIn.slice(0, ROW_CAP),
  };
}

export interface OvertimeToday {
  requestId: string;
  employeeId: string;
  gender: string | null;
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  hours: number;
  status: "PENDING" | "APPROVED";
}

/**
 * Overtime asked for today (waiting or approved), earliest start first, so a
 * manager knows who is staying late tonight. Rejected and cancelled requests
 * are left out. No money is read.
 *
 * @param companyId Company of the caller.
 * @param session Caller; narrows to their own team unless company-wide.
 */
export async function loadOvertimeToday(companyId: string, session: AccessClaims): Promise<OvertimeToday[]> {
  const today = bangkokParts().dateUTC;
  const rows = await prisma.overtimeRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      date: today,
      status: { in: ["PENDING", "APPROVED"] },
      employee: { deletedAt: null, ...(teamScopeFilter(session) ?? {}) },
    },
    select: { id: true, startTime: true, endTime: true, hours: true, status: true, employee: { select: employeeSelect } },
    orderBy: [{ startTime: "asc" }],
    take: ROW_CAP,
  });
  return rows.map((r) => ({
    requestId: r.id,
    employeeId: r.employee.id,
    gender: r.employee.gender ?? null,
    name: displayName(r.employee),
    department: r.employee.department?.name ?? "ไม่ระบุแผนก",
    startTime: r.startTime,
    endTime: r.endTime,
    hours: Math.round(r.hours * 100) / 100,
    status: r.status as "PENDING" | "APPROVED",
  }));
}

export interface MeetingToday {
  id: string;
  title: string;
  location: string | null;
  start: string;
  end: string;
  attendees: number;
}

/**
 * Today's meetings the caller organises or is invited to, in time order.
 *
 * @param companyId Company of the caller.
 * @param employeeId The caller's employee record; none means no meetings.
 */
export async function loadMeetingsToday(companyId: string, employeeId: string | undefined): Promise<MeetingToday[]> {
  if (!employeeId) return [];
  const today = bangkokParts().dateUTC;
  // Bangkok midnight is 17:00 UTC of the day before.
  const from = new Date(today.getTime() - 7 * 3_600_000);
  const to = new Date(from.getTime() + DAY_MS);
  const rows = await prisma.meeting.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { not: "CANCELLED" },
      startAt: { gte: from, lt: to },
      OR: [{ organizerEmployeeId: employeeId }, { attendees: { some: { employeeId } } }],
    },
    select: { id: true, title: true, location: true, startAt: true, endAt: true, _count: { select: { attendees: true } } },
    orderBy: { startAt: "asc" },
    take: 20,
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    location: m.location,
    start: clock(m.startAt),
    end: clock(m.endAt),
    attendees: m._count.attendees,
  }));
}
