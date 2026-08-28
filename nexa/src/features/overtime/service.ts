import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import { broadcastToLineGroups } from "@/lib/integrations/line-group-broadcast";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeHours, estimateAmount, DEFAULT_MULTIPLIER } from "./calc";
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

  const record = await prisma.overtimeRequest.update({
    where: { id: req.id },
    data: {
      status: nextStatus,
      approverEmployeeId: session.employeeId ?? null,
      approverUserId: session.sub,
      decidedAt: new Date(),
      decisionNote: input.note,
      updatedById: session.sub,
    },
    select: requestSelect,
  });

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
