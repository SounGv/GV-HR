import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { displayName } from "@/lib/format";
import { teamScopeFilter } from "@/features/employee/service";

const DAY_MS = 86_400_000;
/** How far back the "forgot to scan out" card looks (today is never included: people are still at work). */
export const MISSED_SCAN_OUT_DAYS = 7;
/** Rows read per card at most; the card says when there are more. */
const ROW_CAP = 60;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clock = (d: Date) =>
  new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(d);

const employeeSelect = {
  employeeCode: true,
  firstName: true,
  lastName: true,
  nickname: true,
  department: { select: { name: true } },
} as const;

export interface MissedScanOut {
  recordId: string;
  name: string;
  department: string;
  /** Bangkok calendar day of the shift (YYYY-MM-DD). */
  dayIso: string;
  /** HH:mm of the scan-in. */
  clockIn: string;
}

/**
 * People who scanned in but never scanned out on one of the last
 * {@link MISSED_SCAN_OUT_DAYS} days, newest first, for the people the caller
 * may see. Their worked hours are blank until a time correction is filed.
 *
 * @param companyId Company of the caller.
 * @param session Caller; narrows to their own team unless company-wide.
 */
export async function loadMissedScanOuts(companyId: string, session: AccessClaims): Promise<{ rows: MissedScanOut[]; days: number }> {
  const today = bangkokParts().dateUTC;
  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      workDate: { gte: new Date(today.getTime() - MISSED_SCAN_OUT_DAYS * DAY_MS), lt: today },
      clockInAt: { not: null },
      clockOutAt: null,
      employee: { deletedAt: null, ...(teamScopeFilter(session) ?? {}) },
    },
    select: { id: true, workDate: true, clockInAt: true, employee: { select: employeeSelect } },
    orderBy: [{ workDate: "desc" }, { clockInAt: "asc" }],
    take: ROW_CAP,
  });
  return {
    days: MISSED_SCAN_OUT_DAYS,
    rows: records.map((r) => ({
      recordId: r.id,
      name: displayName(r.employee),
      department: r.employee.department?.name ?? "ไม่ระบุแผนก",
      dayIso: iso(r.workDate),
      clockIn: r.clockInAt ? clock(r.clockInAt) : "-",
    })),
  };
}

export interface OvertimeToday {
  requestId: string;
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
