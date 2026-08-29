import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import { bangkokParts, lateOrPresent, isEarlyLeave } from "@/lib/datetime";
import { resolveShiftMinutes } from "@/lib/attendance-shift";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  AttendanceCorrectionCreateInput,
  AttendanceCorrectionDecideInput,
  AttendanceCorrectionListQuery,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

const requestSelect = {
  id: true,
  workDate: true,
  requestedClockIn: true,
  requestedClockOut: true,
  reason: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.AttendanceCorrectionRequestSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

/**
 * HR-level approvers may act on ANY request company-wide; a plain Manager
 * only ever holds `attendance:manage` (own-team only, enforced by the
 * managesRequester check at each call site) — `attendance:approve` is
 * deliberately HR-exclusive so this check can't be satisfied by a
 * team-scoped role.
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("attendance:approve");
}

/** Combines a YYYY-MM-DD date with an HH:mm time as a Bangkok wall-clock instant. */
function toBangkokDateTime(workDate: string, time: string): Date {
  return new Date(`${workDate}T${time}:00+07:00`);
}

export async function createAttendanceCorrection(
  companyId: string,
  session: AccessClaims,
  input: AttendanceCorrectionCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);

  // Unlike leave, there was no guard against multiple PENDING correction
  // requests for the same day — a second approval for the same date would
  // silently clobber whatever the first one already wrote to AttendanceRecord
  // (both key on the same employeeId+workDate unique constraint), leaving
  // the earlier request shown as APPROVED even though its effect no longer
  // exists. One pending request per day is enough; a real update just needs
  // to edit or cancel the existing one first.
  const existingPending = await prisma.attendanceCorrectionRequest.findFirst({
    where: { companyId, employeeId, workDate: new Date(input.workDate), status: "PENDING", deletedAt: null },
    select: { id: true },
  });
  if (existingPending) {
    throw Conflict("คุณมีคำขอแก้ไขเวลาสำหรับวันนี้ที่รออนุมัติอยู่แล้ว กรุณารอผลหรือยกเลิกคำขอเดิมก่อน");
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { firstName: true, lastName: true, managerId: true },
  });

  const record = await prisma.attendanceCorrectionRequest.create({
    data: {
      companyId,
      employeeId,
      workDate: new Date(input.workDate),
      requestedClockIn: input.requestedClockIn ? toBangkokDateTime(input.workDate, input.requestedClockIn) : null,
      requestedClockOut: input.requestedClockOut ? toBangkokDateTime(input.workDate, input.requestedClockOut) : null,
      reason: input.reason,
      status: "PENDING",
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: requestSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance_correction.create",
    entity: "AttendanceCorrectionRequest",
    entityId: record.id,
    after: { workDate: input.workDate },
    ...meta,
  });

  if (employee?.managerId) {
    await createNotification(
      companyId,
      employee.managerId,
      {
        title: "มีคำขอแก้ไขเวลาเข้า-ออกงานรออนุมัติ",
        body: `${employee.firstName} ${employee.lastName} ขอแก้ไขเวลาวันที่ ${input.workDate}`,
        category: "attendance",
        link: `/attendance/corrections/${record.id}`,
      },
      session.sub,
    );
  }

  return record;
}

export async function listAttendanceCorrections(
  companyId: string,
  session: AccessClaims,
  query: AttendanceCorrectionListQuery,
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

  return prisma.attendanceCorrectionRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getAttendanceCorrection(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { ...requestSelect, employee: { select: { ...requestSelect.employee.select, managerId: true } } },
  });
  if (!record) throw NotFound("ไม่พบคำขอแก้ไขเวลา");

  const own = record.employee.id === session.employeeId;
  const managesRequester = record.employee.managerId === session.employeeId;
  if (!own && !managesRequester && !isHrLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูคำขอนี้");
  }
  return record;
}

export async function decideAttendanceCorrection(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: AttendanceCorrectionDecideInput,
  meta?: Meta,
) {
  const req = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      employeeId: true,
      status: true,
      workDate: true,
      requestedClockIn: true,
      requestedClockOut: true,
      employee: { select: { managerId: true } },
    },
  });
  if (!req) throw NotFound("ไม่พบคำขอแก้ไขเวลา");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (req.employeeId === session.employeeId) throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");

  const isManager = req.employee.managerId === session.employeeId;
  if (!isManager && !isHrLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะคำขอของทีมที่คุณดูแล");
  }

  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";
  const shift = input.action === "approve" ? await resolveShiftMinutes(req.employeeId, req.workDate) : null;

  const record = await prisma.$transaction(async (tx) => {
    // Compare-and-swap on status: the PENDING check above is a separate
    // round-trip from this write, so two concurrent decide calls (double-
    // click, retry, or a second approver — e.g. one approving, one rejecting)
    // can both pass that check before either commits. Without this guard,
    // both branches could each go on to write their own AttendanceRecord
    // upsert/skip below, leaving the request's final status inconsistent
    // with which write actually took effect.
    const { count } = await tx.attendanceCorrectionRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: {
        status: nextStatus,
        approverEmployeeId: session.employeeId ?? null,
        approverUserId: session.sub,
        decidedAt: new Date(),
        decisionNote: input.note,
        updatedById: session.sub,
      },
    });
    if (count === 0) throw Conflict("คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");
    const rec = await tx.attendanceCorrectionRequest.findFirstOrThrow({ where: { id: req.id }, select: requestSelect });

    if (input.action === "approve") {
      const clockInMinutes = req.requestedClockIn ? bangkokParts(req.requestedClockIn).minutesOfDay : null;
      const clockOutMinutes = req.requestedClockOut ? bangkokParts(req.requestedClockOut).minutesOfDay : null;
      await tx.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: req.employeeId, workDate: req.workDate } },
        create: {
          companyId,
          employeeId: req.employeeId,
          workDate: req.workDate,
          clockInAt: req.requestedClockIn,
          clockOutAt: req.requestedClockOut,
          status: clockInMinutes != null ? lateOrPresent(clockInMinutes, shift!.startMin) : "PRESENT",
          earlyLeaveOut: clockOutMinutes != null ? isEarlyLeave(clockOutMinutes, shift!.endMin) : false,
          note: "แก้ไขเวลาโดยการอนุมัติคำขอแก้ไขเวลาเข้า-ออกงาน",
          createdById: session.sub,
          updatedById: session.sub,
        },
        update: {
          ...(req.requestedClockIn ? { clockInAt: req.requestedClockIn } : {}),
          ...(req.requestedClockOut ? { clockOutAt: req.requestedClockOut } : {}),
          ...(clockInMinutes != null ? { status: lateOrPresent(clockInMinutes, shift!.startMin) } : {}),
          ...(clockOutMinutes != null ? { earlyLeaveOut: isEarlyLeave(clockOutMinutes, shift!.endMin) } : {}),
          updatedById: session.sub,
        },
      });
    }

    return rec;
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `attendance_correction.${input.action}`,
    entity: "AttendanceCorrectionRequest",
    entityId: req.id,
    ...meta,
  });

  await createNotification(
    companyId,
    req.employeeId,
    {
      title: nextStatus === "APPROVED" ? "คำขอแก้ไขเวลาได้รับอนุมัติ" : "คำขอแก้ไขเวลาไม่ได้รับอนุมัติ",
      body: `${nextStatus === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}${input.note ? `: ${input.note}` : ""}`,
      category: "attendance",
      link: `/attendance/corrections/${req.id}`,
    },
    session.sub,
  );

  return record;
}

export async function cancelAttendanceCorrection(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const req = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอแก้ไขเวลา");
  if (req.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ยกเลิกไม่ได้");

  const record = await prisma.attendanceCorrectionRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", updatedById: session.sub },
    select: requestSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "attendance_correction.cancel",
    entity: "AttendanceCorrectionRequest",
    entityId: req.id,
    ...meta,
  });

  return record;
}
