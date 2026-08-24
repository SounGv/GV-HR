import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
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

/** True once `asOf` is at least one full year past `hireDate` (calendar-year
 * anniversary, not a fixed 365-day count — matches how tenure is normally
 * meant in HR policy, including leap years). */
function hasCompletedOneYear(hireDate: Date, asOf: Date): boolean {
  const anniversary = new Date(hireDate);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return asOf >= anniversary;
}

async function getMedicalExpenseCap(companyId: string): Promise<number> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { medicalExpenseCapAmount: true },
  });
  return Number(company?.medicalExpenseCapAmount ?? 4000);
}

/** Medical reimbursement is a benefit gated to employees who have both
 * passed probation and completed a full year of tenure, capped at
 * Company.medicalExpenseCapAmount baht per employee per calendar year
 * (counting PENDING/APPROVED/PAID claims so concurrent submissions can't
 * jointly exceed the cap before any of them are decided). */
async function assertMedicalExpenseAllowed(
  companyId: string,
  employeeId: string,
  amount: number,
  expenseDate: Date,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { hireDate: true, probationEndDate: true },
  });
  const now = new Date();
  const passedProbation = !employee?.probationEndDate || employee.probationEndDate <= now;
  const completedOneYear = !!employee?.hireDate && hasCompletedOneYear(employee.hireDate, now);
  if (!passedProbation || !completedOneYear) {
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

export async function createExpense(
  companyId: string,
  session: AccessClaims,
  input: ExpenseCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  if (input.category === "medical") {
    await assertMedicalExpenseAllowed(companyId, employeeId, input.amount, input.expenseDate);
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
      status: "PENDING",
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: claimSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "expense.create",
    entity: "ExpenseClaim",
    entityId: record.id,
    after: { title: input.title, amount: input.amount },
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
  if (claim.status !== "PENDING") throw BadRequest("ยกเลิกได้เฉพาะรายการที่รออนุมัติ");

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
