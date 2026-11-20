import { displayName } from "@/lib/format";
import { requireEmployeeId as requireEmployee } from "@/lib/auth/employee";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { AppError, BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import { checkGeofence } from "@/lib/geo";
import { can } from "@/lib/auth/rbac";
import { bangkokParts, lateOrPresent, EARLY_LEAVE_GRACE_MIN } from "@/lib/datetime";
import { resolveShiftMinutes } from "@/lib/attendance-shift";
import type { AccessClaims } from "@/lib/auth/jwt";
import { broadcastToLineGroups } from "@/lib/integrations/line-group-broadcast";
import { shouldPostScansToLineGroups } from "@/features/notification/line-policy";
import type { AttendanceListQuery, ClockInput } from "./schema";
import { isEarlyLeaveElapsed, isOpenSessionCurrent, minutesSinceWorkDate } from "./overnight";

const recordSelect = {
  id: true,
  workDate: true,
  clockInAt: true,
  clockOutAt: true,
  clockInLat: true,
  clockInLng: true,
  clockOutLat: true,
  clockOutLng: true,
  clockInDistance: true,
  clockOutDistance: true,
  // The photos themselves are not selected: each is a base64 image of 100 KB or
  // more, so a list of them is megabytes. A list gets `hasClockInPhoto` /
  // `hasClockOutPhoto` instead (see withPhotoFlags) and each image is loaded on
  // its own from /api/attendance/[id]/photo.
  updatedAt: true,
  clockInViaQr: true,
  clockOutViaQr: true,
  breakStartAt: true,
  breakEndAt: true,
  workMode: true,
  moodOut: true,
  earlyLeaveOut: true,
  status: true,
  note: true,
} satisfies Prisma.AttendanceRecordSelect;

const recordWithEmployeeSelect = {
  ...recordSelect,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, nickname: true, avatarUrl: true },
  },
} satisfies Prisma.AttendanceRecordSelect;

type Meta = { ip?: string; userAgent?: string };

/**
 * Attendance rows are keyed by the calendar date at clock-in (Bangkok time),
 * but clock-out / break actions can happen after midnight for a shift that
 * started the day before (e.g. 22:00–06:00). Look for an open session (clocked
 * in, not yet clocked out) on today's date first, then fall back to
 * yesterday's — otherwise an overnight shift can never clock out through the
 * normal flow once the calendar date rolls over.
 */
async function findOpenAttendanceRecord(employeeId: string, todayUTC: Date) {
  const select = {
    id: true,
    workDate: true,
    clockInAt: true,
    clockOutAt: true,
    workMode: true,
    breakStartAt: true,
    breakEndAt: true,
  } satisfies Prisma.AttendanceRecordSelect;

  const today = await prisma.attendanceRecord.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: todayUTC } },
    select,
  });
  if (today?.clockInAt && !today.clockOutAt) return today;

  const yesterdayUTC = new Date(todayUTC.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = await prisma.attendanceRecord.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: yesterdayUTC } },
    select,
  });
  if (yesterday?.clockInAt && !yesterday.clockOutAt) return yesterday;

  return today ?? null;
}

function requireEmployeeId(session: AccessClaims): string {
  return requireEmployee(session, "บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน ไม่สามารถลงเวลาได้");
}

/** Load the employee + branch geofence, or throw. */
async function loadEmployeeWithBranch(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      branch: { select: { id: true, name: true, lat: true, lng: true, radiusMeters: true } },
    },
  });
  if (!employee) throw NotFound("ไม่พบข้อมูลพนักงาน");
  return employee;
}

/**
 * Enforce the branch geofence.
 *  - No geofence configured on the branch → location isn't needed, skip.
 *  - Geofence configured but no GPS point supplied → ask the user to enable GPS.
 *  - Geofence configured + point → must be within the radius.
 */
/**
 * Enforce the branch geofence. Returns the measured distance and whether the
 * point is outside the radius. Being outside is NOT a hard error here — the
 * caller decides (allow with an off-site reason, otherwise reject). Missing GPS
 * on a geofenced branch is still a hard error.
 */
function enforceGeofence(
  branch: { name: string; lat: number | null; lng: number | null; radiusMeters: number | null } | null,
  point: ClockInput,
): { distance: number | null; outside: boolean; branchName: string | null } {
  const hasGeofence =
    !!branch && branch.lat != null && branch.lng != null && branch.radiusMeters != null;
  if (!hasGeofence) {
    return { distance: null, outside: false, branchName: branch?.name ?? null };
  }
  if (point.lat == null || point.lng == null) {
    throw BadRequest(
      `กรุณาอนุญาตการเข้าถึงตำแหน่ง (GPS) เพื่อลงเวลาในพื้นที่สาขา ${branch!.name}`,
    );
  }
  const { distance, withinRadius } = checkGeofence(
    { lat: point.lat, lng: point.lng },
    { lat: branch!.lat!, lng: branch!.lng!, radiusMeters: branch!.radiusMeters! },
  );
  return { distance, outside: !withinRadius, branchName: branch!.name };
}

/**
 * When outside the geofence: the employee needs `attendance:offsite` at all —
 * without it, reject outright with `details.offsite/permitted:false` so the
 * client shows a hard "contact HR" screen, no reason field. With the
 * permission, require an off-site reason instead — reject with
 * `details.offsite/permitted:true` so the client prompts for it. With both
 * permission and a reason, return the note to store on the record.
 */
function resolveOffsite(
  geo: { distance: number | null; outside: boolean; branchName: string | null },
  reason: string | null | undefined,
  permitted: boolean,
): string | null {
  if (!geo.outside) return null;
  const distance = Math.round(geo.distance ?? 0);
  if (!permitted) {
    throw new AppError(
      "FORBIDDEN",
      403,
      `คุณไม่มีสิทธิ์ลงเวลาเข้างานนอกพื้นที่บริษัท (${geo.branchName} — ห่าง ${distance} เมตร) กรุณาติดต่อ HR`,
      { offsite: true, permitted: false, distance, branchName: geo.branchName },
    );
  }
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new AppError(
      "FORBIDDEN",
      403,
      `อยู่นอกพื้นที่ทำงาน (${geo.branchName}) — ห่าง ${distance} เมตร กรุณาระบุเหตุผลการทำงานนอกสถานที่`,
      { offsite: true, permitted: true, distance, branchName: geo.branchName },
    );
  }
  return `ทำงานนอกสถานที่ (ห่าง ${distance} ม.): ${trimmed}`;
}

export async function getToday(companyId: string, session: AccessClaims) {
  const employeeId = requireEmployeeId(session);
  const { dateUTC } = bangkokParts();
  // Sequential, not Promise.all — this app's pooled connection runs with
  // connection_limit=1, so concurrent Prisma calls can throw P2024 instead
  // of both completing.
  let record = await prisma.attendanceRecord.findFirst({
    where: { companyId, employeeId, workDate: dateUTC, deletedAt: null },
    select: recordSelect,
  });
  // Past midnight on an overnight shift (or OT) today has no scan yet, but
  // yesterday's row is still open: show it so the card offers clock-out
  // instead of starting a second record. A row open for more than 16 hours is a
  // forgotten clock-out, so a normal day shift still sees clock-in next morning.
  if (!record?.clockInAt) {
    const yesterday = await prisma.attendanceRecord.findFirst({
      where: {
        companyId,
        employeeId,
        workDate: new Date(dateUTC.getTime() - 24 * 60 * 60 * 1000),
        deletedAt: null,
        clockInAt: { not: null },
        clockOutAt: null,
      },
      select: recordSelect,
    });
    if (yesterday?.clockInAt && isOpenSessionCurrent(yesterday.clockInAt, new Date())) record = yesterday;
  }
  const employee = await loadEmployeeWithBranch(companyId, employeeId);
  return { record, branch: employee.branch };
}

export async function clockIn(
  companyId: string,
  session: AccessClaims,
  input: ClockInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const employee = await loadEmployeeWithBranch(companyId, employeeId);
  const isWfh = input.workMode === "WFH";

  // Scanning the branch's own QR code is treated the same as being inside the
  // geofence — it's a physical-presence proof, so GPS distance isn't required.
  let qrVerified = false;
  if (input.qrBranchId) {
    if (input.qrBranchId !== employee.branch?.id) {
      throw BadRequest("QR นี้ไม่ใช่ของสาขาที่คุณสังกัด");
    }
    qrVerified = true;
  }

  // WFH is a declared exception: the employee isn't expected to be inside the
  // branch geofence, so skip the distance check and off-site reason entirely.
  const geo =
    isWfh || qrVerified
      ? { distance: null, outside: false, branchName: employee.branch?.name ?? null }
      : enforceGeofence(employee.branch, input);
  const offsiteNote =
    isWfh || qrVerified ? null : resolveOffsite(geo, input.offsiteReason, can(session.perms, "attendance:offsite"));
  const distance = geo.distance;
  // OUTSIDE is never chosen by the employee — it's derived from actually
  // being outside the geofence with a declared reason, not the ONSITE/WFH
  // toggle they picked before attempting to clock in.
  const resolvedWorkMode = offsiteNote ? "OUTSIDE" : input.workMode ?? "ONSITE";

  const bp = bangkokParts();
  const now = new Date();
  const workDate = bp.dateUTC;

  const shift = await resolveShiftMinutes(employeeId, workDate);
  const status = lateOrPresent(bp.minutesOfDay, shift.startMin);

  // Guard against a genuine "already clocked in" duplicate atomically, not
  // via a separate read-then-write: two near-simultaneous clock-in calls
  // (e.g. a client retry on a flaky connection) could both pass a plain read
  // check before either commits, and the loser would silently overwrite the
  // winner's clockInAt/photo/location instead of being rejected. Update only
  // matches a row that exists with no clock-in yet (e.g. one an attendance
  // correction created with just a clock-out) — genuinely not a duplicate.
  const { count } = await prisma.attendanceRecord.updateMany({
    where: { employeeId, workDate, clockInAt: null },
    data: {
      clockInAt: now,
      clockInLat: input.lat ?? null,
      clockInLng: input.lng ?? null,
      clockInDistance: distance,
      clockInAccuracy: input.accuracy ?? null,
      clockInPhotoUrl: input.photo ?? null,
      clockInDevice: input.device ?? null,
      clockInBranchId: employee.branch?.id ?? null,
      clockInViaQr: qrVerified,
      workMode: resolvedWorkMode,
      ...(offsiteNote ? { note: offsiteNote } : {}),
      status,
      updatedById: session.sub,
    },
  });
  if (count === 0) {
    // No row with clockInAt: null matched — either no row exists yet (create
    // it) or one already exists with a real clock-in (the unique constraint
    // on employeeId_workDate makes create() fail atomically in that case,
    // so a genuine race here can't let a second create() sneak through).
    try {
      await prisma.attendanceRecord.create({
        data: {
          companyId,
          employeeId,
          workDate,
          clockInAt: now,
          clockInLat: input.lat ?? null,
          clockInLng: input.lng ?? null,
          clockInDistance: distance,
          clockInAccuracy: input.accuracy ?? null,
          clockInPhotoUrl: input.photo ?? null,
          clockInDevice: input.device ?? null,
          clockInBranchId: employee.branch?.id ?? null,
          clockInViaQr: qrVerified,
          workMode: resolvedWorkMode,
          note: offsiteNote,
          status,
          createdById: session.sub,
          updatedById: session.sub,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw Conflict("คุณได้ลงเวลาเข้างานแล้ววันนี้");
      }
      throw err;
    }
  }
  const record = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { employeeId_workDate: { employeeId, workDate } },
    select: recordSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.clock_in",
    entity: "AttendanceRecord",
    entityId: record.id,
    after: { status, distance },
    ...meta,
  });

  const clockInTimeLabel = `${String(bp.hour).padStart(2, "0")}:${String(bp.minute).padStart(2, "0")}`;
  // Off by default: a post per scan is thousands of LINE messages a month (see shouldPostScansToLineGroups).
  if (shouldPostScansToLineGroups()) {
    await broadcastToLineGroups(
      companyId,
      "hr-alerts",
      `🟢 ${displayName(employee)} ลงเวลาเข้างานแล้ว เวลา ${clockInTimeLabel}` +
        (status === "LATE" ? " (มาสาย)" : "") +
        (employee.branch?.name ? `\n${employee.branch.name}` : ""),
        "attendance",
    );
  }

  return record;
}

export async function clockOut(
  companyId: string,
  session: AccessClaims,
  input: ClockInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const employee = await loadEmployeeWithBranch(companyId, employeeId);

  const bp = bangkokParts();
  const existing = await findOpenAttendanceRecord(employeeId, bp.dateUTC);
  if (!existing?.clockInAt) throw BadRequest("ยังไม่ได้ลงเวลาเข้างานวันนี้");
  if (existing.clockOutAt) throw Conflict("คุณได้ลงเวลาออกงานแล้ววันนี้");

  const shift = await resolveShiftMinutes(employeeId, existing.workDate);

  let qrVerified = false;
  if (input.qrBranchId) {
    if (input.qrBranchId !== employee.branch?.id) {
      throw BadRequest("QR นี้ไม่ใช่ของสาขาที่คุณสังกัด");
    }
    qrVerified = true;
  }

  // Distance is recorded for clock-out but not enforced (don't trap people in);
  // skip it entirely for a day declared as WFH at clock-in, or when the branch
  // QR was scanned (physical presence already proven).
  let distance: number | null = null;
  if (
    existing.workMode !== "WFH" &&
    !qrVerified &&
    input.lat != null &&
    input.lng != null &&
    employee.branch?.lat != null &&
    employee.branch.lng != null &&
    employee.branch.radiusMeters != null
  ) {
    distance = checkGeofence(
      { lat: input.lat, lng: input.lng },
      {
        lat: employee.branch.lat,
        lng: employee.branch.lng,
        radiusMeters: employee.branch.radiusMeters,
      },
    ).distance;
  }

  // Guarded write: a double tap or retry must not overwrite the first clock-out's time, photo and place.
  // Early leave is measured from the start of the work date so an overnight shift or OT past midnight is not "early".
  const now = new Date();
  const { count } = await prisma.attendanceRecord.updateMany({
    where: { id: existing.id, clockOutAt: null },
    data: {
      clockOutAt: now,
      clockOutLat: input.lat ?? null,
      clockOutLng: input.lng ?? null,
      clockOutDistance: distance,
      clockOutAccuracy: input.accuracy ?? null,
      clockOutPhotoUrl: input.photo ?? null,
      clockOutDevice: input.device ?? null,
      clockOutViaQr: qrVerified,
      moodOut: input.mood ?? undefined,
      earlyLeaveOut: isEarlyLeaveElapsed(minutesSinceWorkDate(now, existing.workDate), shift, EARLY_LEAVE_GRACE_MIN),
      updatedById: session.sub,
    },
  });
  if (count === 0) throw Conflict("คุณได้ลงเวลาออกงานแล้ววันนี้");
  const record = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: existing.id },
    select: recordSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.clock_out",
    entity: "AttendanceRecord",
    entityId: record.id,
    ...meta,
  });

  const clockOutTimeLabel = `${String(bp.hour).padStart(2, "0")}:${String(bp.minute).padStart(2, "0")}`;
  if (shouldPostScansToLineGroups()) {
    await broadcastToLineGroups(
      companyId,
      "hr-alerts",
      `🔴 ${displayName(employee)} ลงเวลาออกงานแล้ว เวลา ${clockOutTimeLabel}` +
        (record.earlyLeaveOut ? " (ออกก่อนเวลา)" : "") +
        (employee.branch?.name ? `\n${employee.branch.name}` : ""),
        "attendance",
    );
  }

  return record;
}

/** One break window per day — a second start before ending the first is rejected. */
export async function startBreak(companyId: string, session: AccessClaims, meta?: Meta) {
  const employeeId = requireEmployeeId(session);
  const { dateUTC } = bangkokParts();
  const existing = await findOpenAttendanceRecord(employeeId, dateUTC);
  if (!existing?.clockInAt) throw BadRequest("ยังไม่ได้ลงเวลาเข้างานวันนี้");
  if (existing.clockOutAt) throw BadRequest("ลงเวลาออกงานแล้ว ไม่สามารถเริ่มพักได้");
  if (existing.breakStartAt && !existing.breakEndAt) throw Conflict("กำลังพักอยู่แล้ว");
  if (existing.breakStartAt) throw Conflict("พักไปแล้ววันนี้ พักได้วันละครั้ง");

  // Guarded write: only a row with no break yet and no clock-out matches, so a retry cannot wipe a finished break.
  const { count } = await prisma.attendanceRecord.updateMany({
    where: { id: existing.id, breakStartAt: null, clockOutAt: null },
    data: { breakStartAt: new Date(), breakEndAt: null, updatedById: session.sub },
  });
  if (count === 0) throw Conflict("พักไปแล้ววันนี้ หรือลงเวลาออกงานแล้ว");
  const record = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: existing.id },
    select: recordSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.break_start",
    entity: "AttendanceRecord",
    entityId: record.id,
    ...meta,
  });

  return record;
}

export async function endBreak(companyId: string, session: AccessClaims, meta?: Meta) {
  const employeeId = requireEmployeeId(session);
  const { dateUTC } = bangkokParts();
  const existing = await findOpenAttendanceRecord(employeeId, dateUTC);
  if (!existing?.breakStartAt || existing.breakEndAt) {
    throw BadRequest("ยังไม่ได้เริ่มพัก");
  }

  const { count } = await prisma.attendanceRecord.updateMany({
    where: { id: existing.id, breakStartAt: { not: null }, breakEndAt: null },
    data: { breakEndAt: new Date(), updatedById: session.sub },
  });
  if (count === 0) throw BadRequest("ยังไม่ได้เริ่มพัก");
  const record = await prisma.attendanceRecord.findUniqueOrThrow({
    where: { id: existing.id },
    select: recordSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance.break_end",
    entity: "AttendanceRecord",
    entityId: record.id,
    ...meta,
  });

  return record;
}

/**
 * Adds `hasClockInPhoto` / `hasClockOutPhoto` to each record without reading the
 * photos: the filter only tests the column for NULL, so the image data is never
 * fetched. Two queries run one after the other (the connection pool holds one).
 */
async function withPhotoFlags<T extends { id: string }>(records: T[]) {
  if (records.length === 0) return [];
  const ids = records.map((r) => r.id);
  const withIn = await prisma.attendanceRecord.findMany({
    where: { id: { in: ids }, clockInPhotoUrl: { not: null } },
    select: { id: true },
  });
  const withOut = await prisma.attendanceRecord.findMany({
    where: { id: { in: ids }, clockOutPhotoUrl: { not: null } },
    select: { id: true },
  });
  const inIds = new Set(withIn.map((r) => r.id));
  const outIds = new Set(withOut.map((r) => r.id));
  return records.map((r) => ({ ...r, hasClockInPhoto: inIds.has(r.id), hasClockOutPhoto: outIds.has(r.id) }));
}

export async function listAttendance(
  companyId: string,
  session: AccessClaims,
  query: AttendanceListQuery,
) {
  let employeeIds: string[] | undefined;

  if (query.scope === "me") {
    employeeIds = [requireEmployeeId(session)];
  } else if (query.scope === "team") {
    const reports = await prisma.employee.findMany({
      where: { companyId, managerId: session.employeeId ?? "__none__", deletedAt: null },
      select: { id: true },
    });
    employeeIds = reports.map((r) => r.id);
    if (employeeIds.length === 0) return [];
  }
  // scope "all" → no employee filter (company-wide)

  const dateFilter: Prisma.AttendanceRecordWhereInput = {};
  if (query.from || query.to) {
    dateFilter.workDate = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  const withEmployee = query.scope !== "me";

  const records = await prisma.attendanceRecord.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...dateFilter,
    },
    select: withEmployee ? recordWithEmployeeSelect : recordSelect,
    orderBy: { workDate: "desc" },
    take: 200,
  });
  return withPhotoFlags(records);
}
