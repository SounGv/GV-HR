import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeLeaveDays, deductsBalance, DEFAULT_QUOTA } from "./days";
import type { DecideInput, LeaveCreateInput, LeaveListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: "ลาพักร้อน",
  SICK: "ลาป่วย",
  PERSONAL: "ลากิจ",
  UNPAID: "ลาไม่รับค่าจ้าง",
  OTHER: "อื่น ๆ",
};

const requestSelect = {
  id: true,
  type: true,
  startDate: true,
  endDate: true,
  halfDay: true,
  days: true,
  reason: true,
  attachmentUrl: true,
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
  return session.perms.includes("*") || session.perms.includes("leave:approve");
}

/** Remaining days for a paid leave type this year — quota if no balance row exists yet. */
export async function getRemainingBalance(
  companyId: string,
  employeeId: string,
  type: string,
  year: number,
): Promise<number> {
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year_type: { employeeId, year, type: type as never } },
    select: { totalDays: true, usedDays: true },
  });
  const total = balance?.totalDays ?? DEFAULT_QUOTA[type] ?? 0;
  const used = balance?.usedDays ?? 0;
  return Math.max(0, total - used);
}

export async function createLeave(
  companyId: string,
  session: AccessClaims,
  input: LeaveCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const days = computeLeaveDays(input.startDate, input.endDate, input.halfDay);

  if (deductsBalance(input.type)) {
    const remaining = await getRemainingBalance(companyId, employeeId, input.type, input.startDate.getUTCFullYear());
    if (days > remaining) {
      throw BadRequest(
        `วัน${LEAVE_TYPE_LABEL[input.type] ?? input.type}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ ${remaining} วัน แต่ขอลา ${days} วัน`,
      );
    }
  }

  const requester = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { firstName: true, lastName: true, managerId: true },
  });

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
      attachmentUrl: input.attachmentUrl,
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

  if (requester?.managerId) {
    await createNotification(
      companyId,
      requester.managerId,
      {
        title: "มีคำขอลารออนุมัติ",
        body: `${requester.firstName} ${requester.lastName} ขอ${LEAVE_TYPE_LABEL[input.type] ?? input.type} ${days} วัน`,
        category: "leave",
      },
      session.sub,
    );
  }

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

export async function getLeave(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.leaveRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { ...requestSelect, employee: { select: { ...requestSelect.employee.select, managerId: true } } },
  });
  if (!record) throw NotFound("ไม่พบคำขอลา");

  const own = record.employee.id === session.employeeId;
  const managesRequester = record.employee.managerId === session.employeeId;
  if (!own && !managesRequester && !isHrLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูคำขอลานี้");
  }
  return record;
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

  if (input.action === "approve" && deductsBalance(req.type)) {
    const remaining = await getRemainingBalance(companyId, req.employeeId, req.type, req.startDate.getUTCFullYear());
    if (req.days > remaining) {
      throw BadRequest(
        `ไม่สามารถอนุมัติได้ — วัน${LEAVE_TYPE_LABEL[req.type] ?? req.type}คงเหลือของพนักงานไม่พอ (คงเหลือ ${remaining} วัน แต่คำขอนี้ ${req.days} วัน)`,
      );
    }
  }

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

  await createNotification(
    companyId,
    req.employeeId,
    {
      title: nextStatus === "APPROVED" ? "คำขอลาได้รับอนุมัติ" : "คำขอลาไม่ได้รับอนุมัติ",
      body: `${LEAVE_TYPE_LABEL[req.type] ?? req.type} ${req.days} วัน — ${nextStatus === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}${input.note ? `: ${input.note}` : ""}`,
      category: "leave",
    },
    session.sub,
  );

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
