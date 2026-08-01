import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { checkGeofence } from "@/lib/geo";
import { bangkokParts, lateOrPresent } from "@/lib/datetime";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { AttendanceListQuery, ClockInput } from "./schema";

const recordSelect = {
  id: true,
  workDate: true,
  clockInAt: true,
  clockOutAt: true,
  clockInDistance: true,
  clockOutDistance: true,
  status: true,
  note: true,
} satisfies Prisma.AttendanceRecordSelect;

const recordWithEmployeeSelect = {
  ...recordSelect,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.AttendanceRecordSelect;

type Meta = { ip?: string; userAgent?: string };

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) {
    throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน ไม่สามารถลงเวลาได้");
  }
  return session.employeeId;
}

/** Load the employee + branch geofence, or throw. */
async function loadEmployeeWithBranch(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      id: true,
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
function enforceGeofence(
  branch: { name: string; lat: number | null; lng: number | null; radiusMeters: number | null } | null,
  point: ClockInput,
) {
  const hasGeofence =
    !!branch && branch.lat != null && branch.lng != null && branch.radiusMeters != null;
  if (!hasGeofence) {
    return { distance: null as number | null };
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
  if (!withinRadius) {
    throw Forbidden(
      `อยู่นอกพื้นที่ทำงาน (${branch!.name}) — ห่าง ${Math.round(distance)} เมตร`,
    );
  }
  return { distance };
}

export async function getToday(companyId: string, session: AccessClaims) {
  const employeeId = requireEmployeeId(session);
  const { dateUTC } = bangkokParts();
  return prisma.attendanceRecord.findFirst({
    where: { companyId, employeeId, workDate: dateUTC, deletedAt: null },
    select: recordSelect,
  });
}

export async function clockIn(
  companyId: string,
  session: AccessClaims,
  input: ClockInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const employee = await loadEmployeeWithBranch(companyId, employeeId);
  const { distance } = enforceGeofence(employee.branch, input);

  const bp = bangkokParts();
  const now = new Date();
  const workDate = bp.dateUTC;

  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } },
    select: { id: true, clockInAt: true },
  });
  if (existing?.clockInAt) throw Conflict("คุณได้เช็คอินแล้ววันนี้");

  const status = lateOrPresent(bp.minutesOfDay);

  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    create: {
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
      status,
      createdById: session.sub,
      updatedById: session.sub,
    },
    update: {
      clockInAt: now,
      clockInLat: input.lat ?? null,
      clockInLng: input.lng ?? null,
      clockInDistance: distance,
      clockInAccuracy: input.accuracy ?? null,
      clockInPhotoUrl: input.photo ?? null,
      clockInDevice: input.device ?? null,
      clockInBranchId: employee.branch?.id ?? null,
      status,
      updatedById: session.sub,
    },
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

  // Distance is recorded for clock-out but not enforced (don't trap people in).
  let distance: number | null = null;
  if (
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

  const { dateUTC } = bangkokParts();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_workDate: { employeeId, workDate: dateUTC } },
    select: { id: true, clockInAt: true, clockOutAt: true },
  });
  if (!existing?.clockInAt) throw BadRequest("ยังไม่ได้เช็คอินวันนี้");
  if (existing.clockOutAt) throw Conflict("คุณได้เช็คเอาท์แล้ววันนี้");

  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: {
      clockOutAt: new Date(),
      clockOutLat: input.lat ?? null,
      clockOutLng: input.lng ?? null,
      clockOutDistance: distance,
      clockOutAccuracy: input.accuracy ?? null,
      clockOutPhotoUrl: input.photo ?? null,
      clockOutDevice: input.device ?? null,
      updatedById: session.sub,
    },
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

  return record;
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

  return prisma.attendanceRecord.findMany({
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
}
