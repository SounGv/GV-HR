import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { hasCompletedOneYear, hasPassedProbation } from "@/lib/tenure";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { ExpenseClaim } from "./types";
import type { ExpenseCreateInput, ExpenseDecideInput, ExpenseListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const claimSelect = {
  id: true,
  title: true,
  category: true,
  amount: true,
  expenseDate: true,
  description: true,
  receiptUrl: true,
  hospitalName: true,
  sickLeaveRequestId: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  paidAt: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.ExpenseClaimSelect;

type RawClaim = Prisma.ExpenseClaimGetPayload<{ select: typeof claimSelect }>;

function serialize(c: RawClaim): ExpenseClaim {
  return {
    id: c.id,
    title: c.title,
    category: c.category as ExpenseClaim["category"],
    amount: Number(c.amount),
    expenseDate: c.expenseDate.toISOString(),
    description: c.description,
    receiptUrl: c.receiptUrl,
    hospitalName: c.hospitalName,
    sickLeaveRequestId: c.sickLeaveRequestId,
    status: c.status,
    decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
    decisionNote: c.decisionNote,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    employee: c.employee,
  };
}

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

function isFinanceLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("expense:approve");
}

export async function getMedicalExpenseCap(companyId: string): Promise<number> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { medicalExpenseCapAmount: true },
  });
  return Number(company?.medicalExpenseCapAmount ?? 4000);
}

/** Sum of this employee's medical claims for `year`, split by status bucket
 * — the basis for both the eligibility check below and the balance summary
 * shown on the claim form / mobile card. */
export async function getMedicalBenefitSummary(companyId: string, employeeId: string, year: number) {
  const [cap, rows] = await Promise.all([
    getMedicalExpenseCap(companyId),
    prisma.expenseClaim.findMany({
      where: {
        companyId,
        employeeId,
        category: "medical",
        status: { in: ["PENDING", "APPROVED", "PAID"] },
        expenseDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        deletedAt: null,
      },
      select: { amount: true, status: true },
    }),
  ]);
  const approved = rows.filter((r) => r.status === "APPROVED" || r.status === "PAID").reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + Number(r.amount), 0);
  const remaining = Math.max(0, cap - approved - pending);
  return { year, cap, approved, pending, remaining };
}

/** Employee-facing eligibility check, exposed separately so the claim form
 * can show it before the employee fills anything in. */
export async function getMedicalEligibility(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { hireDate: true, probationEndDate: true },
  });
  const now = new Date();
  const passedProbation = hasPassedProbation(employee?.probationEndDate ?? null, now);
  const completedOneYear = !!employee?.hireDate && hasCompletedOneYear(employee.hireDate, now);
  return { eligible: passedProbation && completedOneYear, passedProbation, completedOneYear };
}

/** Medical reimbursement is a benefit gated to employees who have both
 * passed probation and completed a full year of tenure, capped at
 * Company.medicalExpenseCapAmount baht per employee per calendar year
 * (counting DRAFT/PENDING/APPROVED/PAID claims so concurrent submissions
 * can't jointly exceed the cap before any of them are decided). */
async function assertMedicalExpenseAllowed(
  companyId: string,
  employeeId: string,
  amount: number,
  expenseDate: Date,
  excludeClaimId?: string,
) {
  const { eligible } = await getMedicalEligibility(companyId, employeeId);
  if (!eligible) {
    throw BadRequest("สิทธิ์เบิกค่ารักษาพยาบาลจะเปิดให้เมื่อผ่านทดลองงานและทำงานครบ 1 ปีแล้ว");
  }

  const cap = await getMedicalExpenseCap(companyId);
  const year = expenseDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const used = await prisma.expenseClaim.aggregate({
    where: {
      companyId,
      employeeId,
      category: "medical",
      status: { in: ["PENDING", "APPROVED", "PAID"] },
      expenseDate: { gte: yearStart, lt: yearEnd },
      deletedAt: null,
      ...(excludeClaimId ? { id: { not: excludeClaimId } } : {}),
    },
    _sum: { amount: true },
  });
  const usedAmount = Number(used._sum.amount ?? 0);
  const remaining = Math.max(0, cap - usedAmount);
  if (amount > remaining) {
    throw BadRequest(
      `วงเงินค่ารักษาพยาบาลคงเหลือไม่พอ — คงเหลือ ${remaining.toFixed(2)} บาทในปีนี้ (สิทธิ์ ${cap.toFixed(2)} บาท/ปี) แต่ขอเบิก ${amount.toFixed(2)} บาท`,
    );
  }
}

/** Same document can't be claimed twice — checked only for medical claims,
 * where "ห้ามใช้เอกสารหรือเลขที่ใบเสร็จซ้ำ" was explicit. Compares the
 * attached file itself (there's no separate receipt-number field). */
async function assertReceiptNotReused(
  companyId: string,
  employeeId: string,
  receiptUrl: string | null | undefined,
  excludeClaimId?: string,
) {
  if (!receiptUrl) return;
  const existing = await prisma.expenseClaim.findFirst({
    where: {
      companyId,
      employeeId,
      category: "medical",
      receiptUrl,
      status: { notIn: ["REJECTED", "CANCELLED"] },
      deletedAt: null,
      ...(excludeClaimId ? { id: { not: excludeClaimId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw BadRequest("เอกสารใบเสร็จนี้ถูกใช้เบิกไปแล้ว ไม่สามารถใช้ซ้ำได้");
}

/** Validates and returns a snapshot of the referenced sick-leave request —
 * read-only lookup against the leave module's own table; never writes to it
 * or touches its balance, per the explicit "don't modify the leave system"
 * constraint. Loose reference (like this model's existing approverEmployeeId
 * pattern) rather than a formal Prisma relation, so the LeaveRequest model
 * itself never needs to change for this. */
export async function resolveSickLeaveReference(companyId: string, employeeId: string, sickLeaveRequestId: string) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id: sickLeaveRequestId, companyId, employeeId, type: "SICK", deletedAt: null },
    select: { id: true, startDate: true, endDate: true, type: true, attachmentUrl: true },
  });
  if (!leave) throw BadRequest("ไม่พบใบลาป่วยที่อ้างอิง หรือใบลานี้ไม่ใช่ของคุณ");
  return leave;
}

export async function createExpense(
  companyId: string,
  session: AccessClaims,
  input: ExpenseCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const isDraft = input.status === "DRAFT";

  if (input.category === "medical") {
    if (input.sickLeaveRequestId) {
      await resolveSickLeaveReference(companyId, employeeId, input.sickLeaveRequestId);
    }
    if (!isDraft) {
      await assertReceiptNotReused(companyId, employeeId, input.receiptUrl);
      await assertMedicalExpenseAllowed(companyId, employeeId, input.amount, input.expenseDate);
    }
  }

  const record = await prisma.expenseClaim.create({
    data: {
      companyId,
      employeeId,
      title: input.title,
      category: input.category,
      amount: new Prisma.Decimal(input.amount),
      expenseDate: input.expenseDate,
      description: input.description,
      receiptUrl: input.receiptUrl,
      hospitalName: input.hospitalName,
      sickLeaveRequestId: input.sickLeaveRequestId,
      status: isDraft ? "DRAFT" : "PENDING",
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: isDraft ? "expense.draft" : "expense.create",
    entity: "ExpenseClaim",
    entityId: record.id,
    after: { title: input.title, amount: input.amount },
    ...meta,
  });
  return serialize(record);
}

/** Transitions a medical DRAFT claim to PENDING, running the full
 * eligibility/cap/receipt-dedup validation that draft-saving deliberately
 * skips (a draft is allowed to be incomplete or momentarily over-cap while
 * still being edited). */
export async function submitExpense(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const employeeId = requireEmployeeId(session);
  const claim = await prisma.expenseClaim.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, category: true, amount: true, expenseDate: true, receiptUrl: true, status: true },
  });
  if (!claim) throw NotFound("ไม่พบรายการเบิกจ่าย");
  if (claim.employeeId !== employeeId) throw Forbidden("ส่งได้เฉพาะรายการของตนเอง");
  if (claim.status !== "DRAFT") throw BadRequest("ส่งได้เฉพาะรายการที่ยังเป็นฉบับร่าง");

  if (claim.category === "medical") {
    await assertReceiptNotReused(companyId, employeeId, claim.receiptUrl ?? undefined, claim.id);
    await assertMedicalExpenseAllowed(companyId, employeeId, Number(claim.amount), claim.expenseDate, claim.id);
  }

  const record = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: { status: "PENDING", updatedById: session.sub },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "expense.submit",
    entity: "ExpenseClaim",
    entityId: claim.id,
    ...meta,
  });
  return serialize(record);
}

export async function listExpenses(
  companyId: string,
  session: AccessClaims,
  query: ExpenseListQuery,
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

  const rows = await prisma.expenseClaim.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    select: claimSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(serialize);
}

export async function getExpense(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.expenseClaim.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { ...claimSelect, employee: { select: { ...claimSelect.employee.select, managerId: true } } },
  });
  if (!record) throw NotFound("ไม่พบรายการเบิกจ่าย");

  const own = record.employee.id === session.employeeId;
  const managesRequester = record.employee.managerId === session.employeeId;
  if (!own && !managesRequester && !isFinanceLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูรายการเบิกจ่ายนี้");
  }
  return serialize(record);
}

export async function decideExpense(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: ExpenseDecideInput,
  meta?: Meta,
) {
  const claim = await prisma.expenseClaim.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true, employee: { select: { managerId: true } } },
  });
  if (!claim) throw NotFound("ไม่พบรายการเบิกจ่าย");
  if (claim.status !== "PENDING") throw BadRequest("รายการนี้ถูกดำเนินการไปแล้ว");
  if (claim.employeeId === session.employeeId) throw Forbidden("ไม่สามารถอนุมัติรายการของตนเองได้");

  const isManager = claim.employee.managerId === session.employeeId;
  if (!isManager && !isFinanceLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะรายการของทีมที่คุณดูแล");
  }

  const record = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: {
      status: input.action === "approve" ? "APPROVED" : "REJECTED",
      approverEmployeeId: session.employeeId ?? null,
      approverUserId: session.sub,
      decidedAt: new Date(),
      decisionNote: input.note,
      updatedById: session.sub,
    },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `expense.${input.action}`,
    entity: "ExpenseClaim",
    entityId: claim.id,
    ...meta,
  });
  return serialize(record);
}

/** Finance marks an approved claim as paid. Caller must hold expense:approve (route-enforced). */
export async function markExpensePaid(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const claim = await prisma.expenseClaim.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!claim) throw NotFound("ไม่พบรายการเบิกจ่าย");
  if (claim.status !== "APPROVED") throw BadRequest("จ่ายได้เฉพาะรายการที่อนุมัติแล้ว");

  const record = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: { status: "PAID", paidAt: new Date(), updatedById: session.sub },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "expense.pay",
    entity: "ExpenseClaim",
    entityId: claim.id,
    ...meta,
  });
  return serialize(record);
}

export async function cancelExpense(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const claim = await prisma.expenseClaim.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true },
  });
  if (!claim) throw NotFound("ไม่พบรายการเบิกจ่าย");
  if (claim.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะรายการของตนเอง");
  if (claim.status !== "PENDING" && claim.status !== "DRAFT") {
    throw BadRequest("ยกเลิกได้เฉพาะรายการที่เป็นฉบับร่างหรือรออนุมัติ");
  }

  const record = await prisma.expenseClaim.update({
    where: { id: claim.id },
    data: { status: "CANCELLED", updatedById: session.sub },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "expense.cancel",
    entity: "ExpenseClaim",
    entityId: claim.id,
    ...meta,
  });
  return serialize(record);
}
