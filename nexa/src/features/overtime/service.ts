import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import { broadcastToLineGroups } from "@/lib/integrations/line-group-broadcast";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeHours, estimateAmount, minutesSinceWorkDateStart, DEFAULT_MULTIPLIER, MIN_OT_MINUTES } from "./calc";
import type { OtCreateInput, OtDecideInput, OtListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const requestSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  hours: true,
  multiplier: true,
  estimatedAmount: true,
  reason: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.OvertimeRequestSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

/**
 * HR-level approvers may act on ANY request company-wide; a plain Manager
 * only ever holds `overtime:manage` (own-team only, enforced by the
 * managesRequester check at each call site) — `overtime:approve` is
 * deliberately HR-exclusive so this check can't be satisfied by a
 * team-scoped role.
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("overtime:approve");
}

export async function createOvertime(
  companyId: string,
  session: AccessClaims,
  input: OtCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const hours = computeHours(input.startTime, input.endTime);
  if (hours <= 0) throw BadRequest("ช่วงเวลาไม่ถูกต้อง");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: {
      firstName: true,
      lastName: true,
      managerId: true,
      compensationType: true,
      baseSalary: true,
      dailyRate: true,
      hourlyRate: true,
    },
  });
  const estimated = estimateAmount(
    {
      compensationType: employee?.compensationType ?? "MONTHLY",
      baseSalary: employee?.baseSalary ? Number(employee.baseSalary) : null,
      dailyRate: employee?.dailyRate ? Number(employee.dailyRate) : null,
      hourlyRate: employee?.hourlyRate ? Number(employee.hourlyRate) : null,
    },
    hours,
    DEFAULT_MULTIPLIER,
  );

  const record = await prisma.overtimeRequest.create({
    data: {
      companyId,
      employeeId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      hours,
      multiplier: DEFAULT_MULTIPLIER,
      estimatedAmount: estimated,
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
    action: "overtime.create",
    entity: "OvertimeRequest",
    entityId: record.id,
    after: { hours, estimated },
    ...meta,
  });

  if (employee?.managerId) {
    await createNotification(
      companyId,
      employee.managerId,
      {
        title: "มีคำขอ OT รออนุมัติ",
        body: `${employee.firstName} ${employee.lastName} ขอ OT ${hours} ชั่วโมง`,
        category: "overtime",
        link: `/overtime/${record.id}`,
      },
      session.sub,
    );
  }

  await broadcastToLineGroups(
    companyId,
    "hr-alerts",
    `⏱️ มีคำขอ OT รออนุมัติ\n${employee?.firstName} ${employee?.lastName} ขอ OT ${hours} ชั่วโมง`,
  );

  return record;
}

export async function listOvertime(
  companyId: string,
  session: AccessClaims,
  query: OtListQuery,
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

  return prisma.overtimeRequest.findMany({
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

export async function getOvertime(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.overtimeRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { ...requestSelect, employee: { select: { ...requestSelect.employee.select, managerId: true } } },
  });
  if (!record) throw NotFound("ไม่พบคำขอ OT");

  const own = record.employee.id === session.employeeId;
  const managesRequester = record.employee.managerId === session.employeeId;
  if (!own && !managesRequester && !isHrLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูคำขอ OT นี้");
  }
  return record;
}

export async function decideOvertime(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: OtDecideInput,
  meta?: Meta,
) {
  const req = await prisma.overtimeRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true, hours: true, employee: { select: { managerId: true } } },
  });
  if (!req) throw NotFound("ไม่พบคำขอ OT");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (req.employeeId === session.employeeId) throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");

  const isManager = req.employee.managerId === session.employeeId;
  if (!isManager && !isHrLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะคำขอของทีมที่คุณดูแล");
  }

  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";

  // Compare-and-swap on status: the PENDING check above is a separate
  // round-trip from this write, so two concurrent decide calls (double-click,
  // retry, or a second approver) can both pass that check before either
  // commits. Guarding the update on the status already read means only the
  // first call actually flips the status — the second sees count 0 and
  // aborts instead of silently flipping an already-decided request again.
  const { count } = await prisma.overtimeRequest.updateMany({
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
  const record = await prisma.overtimeRequest.findFirstOrThrow({ where: { id: req.id }, select: requestSelect });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `overtime.${input.action}`,
    entity: "OvertimeRequest",
    entityId: req.id,
    ...meta,
  });

  await createNotification(
    companyId,
    req.employeeId,
    {
      title: nextStatus === "APPROVED" ? "คำขอ OT ได้รับอนุมัติ" : "คำขอ OT ไม่ได้รับอนุมัติ",
      body: `OT ${req.hours} ชั่วโมง — ${nextStatus === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}${input.note ? `: ${input.note}` : ""}`,
      category: "overtime",
      link: `/overtime/${req.id}`,
    },
    session.sub,
  );

  return record;
}

export async function cancelOvertime(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const req = await prisma.overtimeRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอ OT");
  if (req.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw BadRequest("คำขอนี้ยกเลิกไม่ได้");
  }

  const record = await prisma.overtimeRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", updatedById: session.sub },
    select: requestSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "overtime.cancel",
    entity: "OvertimeRequest",
    entityId: req.id,
    ...meta,
  });

  return record;
}

/**
 * Scans existing attendance records over [from, to) for clock-outs past the
 * employee's shift end with no OT request behind them yet, and auto-creates
 * an already-APPROVED one for the excess — same rule the attendance import
 * applies to rows it creates itself, but this also covers attendance that
 * arrived some other way (a prior import run, a direct DB backfill, a time-
 * clock device sync) where nothing was ever there to hook the check into.
 * Skips any (employee, date) that already has an OvertimeRequest of any
 * status, so it never creates a duplicate alongside one the employee
 * actually submitted.
 */
export async function reconcileOvertimeFromAttendance(
  companyId: string,
  session: AccessClaims,
  from: Date,
  to: Date,
  meta?: Meta,
): Promise<{ scanned: number; created: number }> {
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, workDate: { gte: from, lt: to }, clockInAt: { not: null }, clockOutAt: { not: null } },
    select: {
      employeeId: true,
      workDate: true,
      clockOutAt: true,
      employee: {
        select: { compensationType: true, baseSalary: true, dailyRate: true, hourlyRate: true },
      },
    },
  });
  if (records.length === 0) return { scanned: 0, created: 0 };

  const existingOt = await prisma.overtimeRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      employeeId: { in: [...new Set(records.map((r) => r.employeeId))] },
      date: { gte: from, lt: to },
    },
    select: { employeeId: true, date: true },
  });
  const hasOt = new Set(existingOt.map((o) => `${o.employeeId}|${o.date.toISOString().slice(0, 10)}`));

  const rangeEnd = new Date(to);
  const shiftMap = await resolveShiftMinutesBatch(companyId, from, rangeEnd);

  let created = 0;
  for (const r of records) {
    const key = `${r.employeeId}|${r.workDate.toISOString().slice(0, 10)}`;
    if (hasOt.has(key)) continue;
    // Saturday is a company-wide half day — time worked past the (already
    // shortened) shift end doesn't count as OT, per company policy.
    if (r.workDate.getUTCDay() === 6) continue;

    // Elapsed minutes since the work day's Bangkok midnight — NOT the same
    // as "minutes since clockOutAt's own midnight", which wraps to a small
    // number (and silently drops the overtime) for an after-midnight
    // clock-out on an overnight shift.
    const elapsedMinutes = minutesSinceWorkDateStart(r.clockOutAt!, r.workDate);
    const shift = shiftMinutesFromBatch(shiftMap, r.employeeId, r.workDate);
    const excessMinutes = elapsedMinutes - shift.endMin;
    if (excessMinutes < MIN_OT_MINUTES) continue;

    const hours = Math.round((excessMinutes / 60) * 100) / 100;
    const estimated = estimateAmount(
      {
        compensationType: r.employee.compensationType,
        baseSalary: r.employee.baseSalary ? Number(r.employee.baseSalary) : null,
        dailyRate: r.employee.dailyRate ? Number(r.employee.dailyRate) : null,
        hourlyRate: r.employee.hourlyRate ? Number(r.employee.hourlyRate) : null,
      },
      hours,
      DEFAULT_MULTIPLIER,
    );
    const shiftEndLabel = `${String(Math.floor(shift.endMin / 60)).padStart(2, "0")}:${String(shift.endMin % 60).padStart(2, "0")}`;
    // Display-only "HH:mm" — wraps past midnight (e.g. 1460 min → "00:20"),
    // which is fine for a label; the money math above uses elapsedMinutes.
    const clockOutMinutesOfDay = ((elapsedMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const clockOutLabel = `${String(Math.floor(clockOutMinutesOfDay / 60)).padStart(2, "0")}:${String(clockOutMinutesOfDay % 60).padStart(2, "0")}`;

    await prisma.overtimeRequest.create({
      data: {
        companyId,
        employeeId: r.employeeId,
        date: r.workDate,
        startTime: shiftEndLabel,
        endTime: clockOutLabel,
        hours,
        multiplier: DEFAULT_MULTIPLIER,
        estimatedAmount: estimated,
        reason: "สร้างอัตโนมัติจากการตรวจสอบเวลาเข้า-ออกงานย้อนหลัง (เวลาออกเกินกะ)",
        status: "APPROVED",
        approverEmployeeId: session.employeeId ?? null,
        approverUserId: session.sub,
        decidedAt: new Date(),
        decisionNote: "อนุมัติอัตโนมัติจากการตรวจสอบเวลาเข้า-ออกงานย้อนหลัง",
        createdById: session.sub,
        updatedById: session.sub,
      },
    });
    created++;
  }

  if (created > 0) {
    await writeAudit({
      companyId,
      actorUserId: session.sub,
      action: "overtime.reconcile_from_attendance",
      entity: "OvertimeRequest",
      after: { scanned: records.length, created },
      ...meta,
    });
  }

  return { scanned: records.length, created };
}
