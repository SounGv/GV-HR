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

export async function createExpense(
  companyId: string,
  session: AccessClaims,
  input: ExpenseCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
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
