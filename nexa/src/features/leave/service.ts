import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeLeaveDays, deductsBalance, DEFAULT_QUOTA } from "./days";
import type { DecideInput, LeaveCreateInput, LeaveListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const requestSelect = {
  id: true,
  type: true,
  startDate: true,
  endDate: true,
  halfDay: true,
  days: true,
  reason: true,
  status: true,
  approverEmployeeId: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.LeaveRequestSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

/** HR-level approvers (wildcard leave permission) may act on any request. */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("leave:*");
}

export async function createLeave(
  companyId: string,
  session: AccessClaims,
  input: LeaveCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const days = computeLeaveDays(input.startDate, input.endDate, input.halfDay);

  const record = await prisma.leaveRequest.create({
    data: {
      companyId,
      employeeId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay,
      days,
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
    action: "leave.create",
    entity: "LeaveRequest",
    entityId: record.id,
    after: { type: input.type, days },
    ...meta,
  });

  return record;
}

export async function listLeave(
  companyId: string,
  session: AccessClaims,
  query: LeaveListQuery,
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
  // scope "all" → company-wide

  return prisma.leaveRequest.findMany({
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

export async function decideLeave(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: DecideInput,
  meta?: Meta,
) {
  const req = await prisma.leaveRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      employeeId: true,
      type: true,
      days: true,
      status: true,
      startDate: true,
      employee: { select: { managerId: true } },
    },
  });
  if (!req) throw NotFound("ไม่พบคำขอลา");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");

  // Governance: can't approve your own request.
  if (req.employeeId === session.employeeId) {
    throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");
  }
  // Authorization: only the requester's manager, or an HR-level approver.
  const isManager = req.employee.managerId === session.employeeId;
  if (!isManager && !isHrLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะคำขอของทีมที่คุณดูแล");
  }

  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.leaveRequest.update({
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

    if (input.action === "approve" && deductsBalance(req.type)) {
      const year = req.startDate.getUTCFullYear();
      await tx.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: req.employeeId, year, type: req.type } },
        update: { usedDays: { increment: req.days } },
        create: {
          companyId,
          employeeId: req.employeeId,
          year,
          type: req.type,
          totalDays: DEFAULT_QUOTA[req.type] ?? 0,
          usedDays: req.days,
        },
      });
    }

    return rec;
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `leave.${input.action}`,
    entity: "LeaveRequest",
    entityId: req.id,
    after: { status: nextStatus },
    ...meta,
  });

  return updated;
}

export async function cancelLeave(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const req = await prisma.leaveRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, type: true, days: true, status: true, startDate: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอลา");
  if (req.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw BadRequest("คำขอนี้ยกเลิกไม่ได้");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rec = await tx.leaveRequest.update({
      where: { id: req.id },
      data: { status: "CANCELLED", updatedById: session.sub },
      select: requestSelect,
    });

    // Restore balance if a previously-approved paid leave is cancelled.
    if (req.status === "APPROVED" && deductsBalance(req.type)) {
      const year = req.startDate.getUTCFullYear();
      await tx.leaveBalance.updateMany({
        where: { employeeId: req.employeeId, year, type: req.type },
        data: { usedDays: { decrement: req.days } },
      });
    }

    return rec;
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "leave.cancel",
    entity: "LeaveRequest",
    entityId: req.id,
    ...meta,
  });

  return updated;
}

export async function getBalances(companyId: string, session: AccessClaims, year?: number) {
  const employeeId = requireEmployeeId(session);
  const y = year ?? new Date().getFullYear();
  return prisma.leaveBalance.findMany({
    where: { companyId, employeeId, year: y },
    select: { id: true, type: true, year: true, totalDays: true, usedDays: true },
    orderBy: { type: "asc" },
  });
}
