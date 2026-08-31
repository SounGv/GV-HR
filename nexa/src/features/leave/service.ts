import { Prisma, type LeaveType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import { broadcastToLineGroups } from "@/lib/integrations/line-group-broadcast";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeLeaveDays, computeLeaveHours, deductsBalance, HOURLY_LEAVE_TYPES, PAID_LEAVE_TYPES } from "./days";
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
  unit: true,
  hours: true,
  startTime: true,
  endTime: true,
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

/**
 * HR-level approvers may act on ANY request company-wide; a plain Manager
 * only ever holds `leave:manage` (own-team only, enforced by the
 * managesRequester check at each call site) — `leave:approve` is deliberately
 * HR-exclusive so this check can't be satisfied by a team-scoped role.
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("leave:approve");
}

// Historical system defaults — used only as a fallback so requesting leave
// keeps working before HR sets real numbers. Company.leaveQuota{Annual,Sick,
// Personal}Days are nullable with no @default specifically so "never
// configured" (null) can't be confused with a deliberate real value.
const FALLBACK_DAY_QUOTA: Record<string, number> = { ANNUAL: 10, SICK: 30, PERSONAL: 3 };

/** HR-configured default quota (days/year) per paid leave type, for this company. */
async function getCompanyLeaveQuota(companyId: string): Promise<Record<string, number>> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { leaveQuotaAnnualDays: true, leaveQuotaSickDays: true, leaveQuotaPersonalDays: true },
  });
  return {
    ANNUAL: company?.leaveQuotaAnnualDays ?? FALLBACK_DAY_QUOTA.ANNUAL,
    SICK: company?.leaveQuotaSickDays ?? FALLBACK_DAY_QUOTA.SICK,
    PERSONAL: company?.leaveQuotaPersonalDays ?? FALLBACK_DAY_QUOTA.PERSONAL,
    UNPAID: 0,
    OTHER: 0,
  };
}

/** Whether HR has actually set a real day-quota for this company (any of the
 * three types configured counts as "reviewed") — the UI hides the numbers
 * while this is false instead of showing an unreviewed fallback as policy. */
export async function isCompanyLeaveQuotaConfigured(companyId: string): Promise<boolean> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { leaveQuotaAnnualDays: true, leaveQuotaSickDays: true, leaveQuotaPersonalDays: true },
  });
  return (
    company?.leaveQuotaAnnualDays != null ||
    company?.leaveQuotaSickDays != null ||
    company?.leaveQuotaPersonalDays != null
  );
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
  if (balance) return Math.max(0, balance.totalDays - balance.usedDays);
  const quota = await getCompanyLeaveQuota(companyId);
  return Math.max(0, quota[type] ?? 0);
}

/** HR-configured hourly quota (hours/year) for the leave types that support it. */
async function getCompanyLeaveHourQuota(companyId: string): Promise<Record<string, number>> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { leaveQuotaSickHours: true, leaveQuotaPersonalHours: true },
  });
  return {
    SICK: company?.leaveQuotaSickHours ?? 0,
    PERSONAL: company?.leaveQuotaPersonalHours ?? 0,
  };
}

/** Remaining hours for a leave type this year — a separate pool from
 * `getRemainingBalance`'s days, never converted to/from it. */
export async function getRemainingHourBalance(
  companyId: string,
  employeeId: string,
  type: string,
  year: number,
): Promise<number> {
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_year_type: { employeeId, year, type: type as never } },
    select: { totalHours: true, usedHours: true },
  });
  if (balance) return Math.max(0, balance.totalHours - balance.usedHours);
  const quota = await getCompanyLeaveHourQuota(companyId);
  return Math.max(0, quota[type] ?? 0);
}

export async function createLeave(
  companyId: string,
  session: AccessClaims,
  input: LeaveCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const isHourly = input.unit === "HOUR";
  const days = isHourly ? 0 : computeLeaveDays(input.startDate, input.endDate, input.halfDay);
  const hours = isHourly ? computeLeaveHours(input.startTime!, input.endTime!) : null;

  if (isHourly) {
    if (!(HOURLY_LEAVE_TYPES as readonly string[]).includes(input.type)) {
      throw BadRequest("ลาเป็นชั่วโมงได้เฉพาะลาป่วย/ลากิจ");
    }
    const remaining = await getRemainingHourBalance(companyId, employeeId, input.type, input.startDate.getUTCFullYear());
    if (hours! > remaining) {
      throw BadRequest(
        `ชั่วโมง${LEAVE_TYPE_LABEL[input.type] ?? input.type}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ ${remaining} ชม. แต่ขอลา ${hours} ชม.`,
      );
    }
  } else if (deductsBalance(input.type)) {
    const remaining = await getRemainingBalance(companyId, employeeId, input.type, input.startDate.getUTCFullYear());
    if (days > remaining) {
      throw BadRequest(
        `วัน${LEAVE_TYPE_LABEL[input.type] ?? input.type}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ ${remaining} วัน แต่ขอลา ${days} วัน`,
      );
    }
  }

  // A full-day request conflicts with anything overlapping that date range
  // regardless of unit; an hourly request can only be reliably said to
  // conflict with an existing full-day request covering that date — two
  // hourly requests on the same day may occupy different time slots we don't
  // compare here. Without this, the same date range could be approved twice
  // and LeaveBalance debited twice for the same day(s).
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      companyId,
      employeeId,
      deletedAt: null,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: input.endDate },
      endDate: { gte: input.startDate },
      ...(isHourly ? { unit: "DAY" } : {}),
    },
    select: { id: true },
  });
  if (overlap) {
    throw BadRequest("คุณมีคำขอลาในช่วงวันที่นี้อยู่แล้ว กรุณาตรวจสอบหรือยกเลิกคำขอเดิมก่อนยื่นใหม่");
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
      unit: input.unit,
      hours,
      startTime: isHourly ? input.startTime : null,
      endTime: isHourly ? input.endTime : null,
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
    after: isHourly ? { type: input.type, hours } : { type: input.type, days },
    ...meta,
  });

  const amountLabel = isHourly ? `${hours} ชม. (${input.startTime}–${input.endTime})` : `${days} วัน`;
  if (requester?.managerId) {
    await createNotification(
      companyId,
      requester.managerId,
      {
        title: "มีคำขอลารออนุมัติ",
        body: `${requester.firstName} ${requester.lastName} ขอ${LEAVE_TYPE_LABEL[input.type] ?? input.type} ${amountLabel}`,
        category: "leave",
        link: `/leave/${record.id}`,
      },
      session.sub,
    );
  }

  await broadcastToLineGroups(
    companyId,
    "hr-alerts",
    `📋 มีคำขอลารออนุมัติ\n${requester?.firstName} ${requester?.lastName} ขอ${LEAVE_TYPE_LABEL[input.type] ?? input.type} ${amountLabel}`,
  );

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
      unit: true,
      hours: true,
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
  const isHourly = req.unit === "HOUR";

  let quotaDaysForNewBalance = 0;
  let quotaHoursForNewBalance = 0;
  if (input.action === "approve") {
    if (isHourly) {
      const remaining = await getRemainingHourBalance(companyId, req.employeeId, req.type, req.startDate.getUTCFullYear());
      if ((req.hours ?? 0) > remaining) {
        throw BadRequest(
          `ไม่สามารถอนุมัติได้ — ชั่วโมง${LEAVE_TYPE_LABEL[req.type] ?? req.type}คงเหลือของพนักงานไม่พอ (คงเหลือ ${remaining} ชม. แต่คำขอนี้ ${req.hours} ชม.)`,
        );
      }
      const hourQuota = await getCompanyLeaveHourQuota(companyId);
      quotaHoursForNewBalance = hourQuota[req.type] ?? 0;
      const dayQuota = await getCompanyLeaveQuota(companyId);
      quotaDaysForNewBalance = dayQuota[req.type] ?? 0;
    } else if (deductsBalance(req.type)) {
      const remaining = await getRemainingBalance(companyId, req.employeeId, req.type, req.startDate.getUTCFullYear());
      if (req.days > remaining) {
        throw BadRequest(
          `ไม่สามารถอนุมัติได้ — วัน${LEAVE_TYPE_LABEL[req.type] ?? req.type}คงเหลือของพนักงานไม่พอ (คงเหลือ ${remaining} วัน แต่คำขอนี้ ${req.days} วัน)`,
        );
      }
      const quota = await getCompanyLeaveQuota(companyId);
      quotaDaysForNewBalance = quota[req.type] ?? 0;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Compare-and-swap on status: the PENDING check above and the balance
    // upsert below are separate round-trips, so two concurrent decide calls
    // (double-click, retry, or a second approver) can both pass that check
    // before either commits. Guarding this update on the status already read
    // means only the first transaction proceeds to the balance increment —
    // the second sees count 0 and aborts before ever touching LeaveBalance.
    const { count } = await tx.leaveRequest.updateMany({
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
    const rec = await tx.leaveRequest.findFirstOrThrow({ where: { id: req.id }, select: requestSelect });

    if (input.action === "approve" && (isHourly || deductsBalance(req.type))) {
      const year = req.startDate.getUTCFullYear();
      await tx.leaveBalance.upsert({
        where: { employeeId_year_type: { employeeId: req.employeeId, year, type: req.type } },
        update: isHourly ? { usedHours: { increment: req.hours ?? 0 } } : { usedDays: { increment: req.days } },
        create: {
          companyId,
          employeeId: req.employeeId,
          year,
          type: req.type,
          totalDays: quotaDaysForNewBalance,
          usedDays: isHourly ? 0 : req.days,
          totalHours: quotaHoursForNewBalance,
          usedHours: isHourly ? req.hours ?? 0 : 0,
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

  const decidedAmountLabel = isHourly ? `${req.hours} ชม.` : `${req.days} วัน`;
  await createNotification(
    companyId,
    req.employeeId,
    {
      title: nextStatus === "APPROVED" ? "คำขอลาได้รับอนุมัติ" : "คำขอลาไม่ได้รับอนุมัติ",
      body: `${LEAVE_TYPE_LABEL[req.type] ?? req.type} ${decidedAmountLabel} — ${nextStatus === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}${input.note ? `: ${input.note}` : ""}`,
      category: "leave",
      link: `/leave/${req.id}`,
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
    select: { id: true, employeeId: true, type: true, days: true, unit: true, hours: true, status: true, startDate: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอลา");
  if (req.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING" && req.status !== "APPROVED") {
    throw BadRequest("คำขอนี้ยกเลิกไม่ได้");
  }

  const isHourly = req.unit === "HOUR";

  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id: req.id, status: req.status },
      data: { status: "CANCELLED", updatedById: session.sub },
    });
    if (count === 0) throw Conflict("คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");
    const rec = await tx.leaveRequest.findFirstOrThrow({
      where: { id: req.id },
      select: requestSelect,
    });

    // Restore balance if a previously-approved paid leave is cancelled.
    if (req.status === "APPROVED" && (isHourly || deductsBalance(req.type))) {
      const year = req.startDate.getUTCFullYear();
      await tx.leaveBalance.updateMany({
        where: { employeeId: req.employeeId, year, type: req.type },
        data: isHourly ? { usedHours: { decrement: req.hours ?? 0 } } : { usedDays: { decrement: req.days } },
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

/**
 * Balances for all paid leave types this year, in a fixed display order.
 * A type with no LeaveBalance row yet (no leave of that type ever approved
 * this year) is synthesized from the company's default quota so the UI shows
 * the full entitlement from day one instead of an empty state — but if HR
 * has never actually configured a real quota, that synthesized number is
 * just the historical system fallback, not a reviewed policy. `daysConfigured`
 * flags that case so the UI can hide the number instead of showing it as if
 * it were real; an existing LeaveBalance row is always treated as configured
 * (it exists because a leave of that type was actually approved before).
 */
export async function getBalances(companyId: string, session: AccessClaims, year?: number) {
  const employeeId = requireEmployeeId(session);
  const y = year ?? new Date().getFullYear();
  const rows = await prisma.leaveBalance.findMany({
    where: { companyId, employeeId, year: y },
    select: { id: true, type: true, year: true, totalDays: true, usedDays: true, totalHours: true, usedHours: true },
  });
  const byType = new Map(rows.map((r) => [r.type as string, r]));
  const quota = await getCompanyLeaveQuota(companyId);
  const hourQuota = await getCompanyLeaveHourQuota(companyId);
  const daysConfigured = await isCompanyLeaveQuotaConfigured(companyId);

  return PAID_LEAVE_TYPES.map((type) => {
    const existing = byType.get(type);
    if (existing) return { ...existing, daysConfigured: true };
    return {
      id: `virtual-${type}-${y}`,
      daysConfigured,
      type: type as LeaveType,
      year: y,
      totalDays: quota[type] ?? 0,
      usedDays: 0,
      totalHours: hourQuota[type] ?? 0,
      usedHours: 0,
    };
  });
}
