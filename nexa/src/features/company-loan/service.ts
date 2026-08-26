import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { createNotification } from "@/features/notification/service";
import { hasCompletedOneYear, hasPassedProbation } from "@/lib/tenure";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CompanyLoanRequest, LoanEligibility } from "./types";
import type { LoanCreateInput, LoanDecideInput, LoanListQuery, LoanRepayInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const loanSelect = {
  id: true,
  year: true,
  amount: true,
  salarySnapshot: true,
  installmentCount: true,
  reason: true,
  bankName: true,
  bankAccountNo: true,
  attachmentUrl: true,
  repaidAmount: true,
  status: true,
  decidedAt: true,
  decisionNote: true,
  paidAt: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.CompanyLoanRequestSelect;

type RawLoan = Prisma.CompanyLoanRequestGetPayload<{ select: typeof loanSelect }>;

function serialize(l: RawLoan): CompanyLoanRequest {
  return {
    id: l.id,
    year: l.year,
    amount: Number(l.amount),
    salarySnapshot: Number(l.salarySnapshot),
    installmentCount: l.installmentCount,
    reason: l.reason,
    bankName: l.bankName,
    bankAccountNo: l.bankAccountNo,
    attachmentUrl: l.attachmentUrl,
    repaidAmount: Number(l.repaidAmount),
    status: l.status as CompanyLoanRequest["status"],
    decidedAt: l.decidedAt ? l.decidedAt.toISOString() : null,
    decisionNote: l.decisionNote,
    paidAt: l.paidAt ? l.paidAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
    employee: l.employee,
  };
}

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

function isFinanceLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("expense:approve");
}

/** "เงินเดือนประจำ" — only meaningful for MONTHLY-compensated employees, per
 * the benefit's own wording. DAILY/HOURLY employees have no monthly-salary
 * figure to cap against, so they're not eligible (no conversion formula was
 * requested, and inventing one risks getting the cap wrong). */
export async function getLoanEligibility(companyId: string, employeeId: string): Promise<LoanEligibility> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { status: true, hireDate: true, probationEndDate: true, compensationType: true, baseSalary: true },
  });
  const now = new Date();
  const passedProbation = hasPassedProbation(employee?.probationEndDate ?? null, now);
  const completedOneYear = !!employee?.hireDate && hasCompletedOneYear(employee.hireDate, now);
  const currentSalary =
    employee?.status === "ACTIVE" && employee.compensationType === "MONTHLY" && employee.baseSalary != null
      ? Number(employee.baseSalary)
      : null;

  const year = now.getUTCFullYear();
  const existing = await prisma.companyLoanRequest.findFirst({
    where: { companyId, employeeId, year, status: { in: ["PENDING", "APPROVED", "PAID"] }, deletedAt: null },
    select: { id: true },
  });
  const usedThisYear = !!existing;

  return {
    eligible: passedProbation && completedOneYear && currentSalary != null && !usedThisYear,
    passedProbation,
    completedOneYear,
    currentSalary,
    maxLoanAmount: currentSalary ?? 0,
    usedThisYear,
  };
}

async function assertLoanAllowed(companyId: string, employeeId: string, amount: number): Promise<number> {
  const eligibility = await getLoanEligibility(companyId, employeeId);
  if (!eligibility.passedProbation || !eligibility.completedOneYear) {
    throw BadRequest("สิทธิ์กู้เงินบริษัทจะเปิดให้เมื่อผ่านทดลองงานและทำงานครบ 1 ปีแล้ว");
  }
  if (eligibility.currentSalary == null) {
    throw BadRequest("ไม่มีข้อมูลเงินเดือนประจำของคุณในระบบ ไม่สามารถคำนวณวงเงินกู้ได้ (ใช้ได้เฉพาะพนักงานรายเดือน)");
  }
  if (eligibility.usedThisYear) {
    throw BadRequest("คุณใช้สิทธิ์กู้เงินบริษัทของปีนี้ไปแล้ว — กู้ได้ปีละ 1 ครั้ง");
  }
  if (amount > eligibility.maxLoanAmount) {
    throw BadRequest(
      `วงเงินกู้สูงสุดของคุณคือ ${eligibility.maxLoanAmount.toFixed(2)} บาท (เท่ากับเงินเดือนประจำ) แต่ขอกู้ ${amount.toFixed(2)} บาท`,
    );
  }
  return eligibility.currentSalary;
}

export async function createLoan(companyId: string, session: AccessClaims, input: LoanCreateInput, meta?: Meta) {
  const employeeId = requireEmployeeId(session);
  const salarySnapshot = await assertLoanAllowed(companyId, employeeId, input.amount);
  const year = new Date().getUTCFullYear();

  const requester = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { firstName: true, lastName: true, managerId: true },
  });

  const record = await prisma.companyLoanRequest.create({
    data: {
      companyId,
      employeeId,
      year,
      amount: new Prisma.Decimal(input.amount),
      salarySnapshot: new Prisma.Decimal(salarySnapshot),
      installmentCount: input.installmentCount,
      reason: input.reason,
      bankName: input.bankName,
      bankAccountNo: input.bankAccountNo,
      attachmentUrl: input.attachmentUrl,
      status: "PENDING",
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: loanSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "loan.create",
    entity: "CompanyLoanRequest",
    entityId: record.id,
    after: { amount: input.amount, installmentCount: input.installmentCount },
    ...meta,
  });

  if (requester?.managerId) {
    await createNotification(
      companyId,
      requester.managerId,
      {
        title: "มีคำขอกู้เงินบริษัทรออนุมัติ",
        body: `${requester.firstName} ${requester.lastName} ขอกู้เงิน ${input.amount.toFixed(2)} บาท`,
        category: "expense",
        link: `/benefits/loans/${record.id}`,
      },
      session.sub,
    );
  }

  return serialize(record);
}

export async function listLoans(companyId: string, session: AccessClaims, query: LoanListQuery) {
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

  const rows = await prisma.companyLoanRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    select: loanSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(serialize);
}

export async function getLoan(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.companyLoanRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { ...loanSelect, employee: { select: { ...loanSelect.employee.select, managerId: true } } },
  });
  if (!record) throw NotFound("ไม่พบคำขอกู้เงิน");

  const own = record.employee.id === session.employeeId;
  const managesRequester = record.employee.managerId === session.employeeId;
  if (!own && !managesRequester && !isFinanceLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูคำขอกู้เงินนี้");
  }
  return serialize(record);
}

export async function decideLoan(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: LoanDecideInput,
  meta?: Meta,
) {
  const loan = await prisma.companyLoanRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, amount: true, status: true, employee: { select: { managerId: true } } },
  });
  if (!loan) throw NotFound("ไม่พบคำขอกู้เงิน");
  if (loan.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (loan.employeeId === session.employeeId) throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");

  const isManager = loan.employee.managerId === session.employeeId;
  if (!isManager && !isFinanceLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะคำขอของทีมที่คุณดูแล");
  }

  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";
  const record = await prisma.companyLoanRequest.update({
    where: { id: loan.id },
    data: {
      status: nextStatus,
      approverEmployeeId: session.employeeId ?? null,
      approverUserId: session.sub,
      decidedAt: new Date(),
      decisionNote: input.note,
      updatedById: session.sub,
    },
    select: loanSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `loan.${input.action}`,
    entity: "CompanyLoanRequest",
    entityId: loan.id,
    ...meta,
  });

  await createNotification(
    companyId,
    loan.employeeId,
    {
      title: nextStatus === "APPROVED" ? "คำขอกู้เงินบริษัทได้รับอนุมัติ" : "คำขอกู้เงินบริษัทไม่ได้รับอนุมัติ",
      body: `${Number(loan.amount).toFixed(2)} บาท — ${nextStatus === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติ"}${input.note ? `: ${input.note}` : ""}`,
      category: "expense",
      link: `/benefits/loans/${loan.id}`,
    },
    session.sub,
  );

  return serialize(record);
}

/** Finance marks an approved loan as paid (disbursed). */
export async function markLoanPaid(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const loan = await prisma.companyLoanRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!loan) throw NotFound("ไม่พบคำขอกู้เงิน");
  if (loan.status !== "APPROVED") throw BadRequest("จ่ายได้เฉพาะคำขอที่อนุมัติแล้ว");

  const record = await prisma.companyLoanRequest.update({
    where: { id: loan.id },
    data: { status: "PAID", paidAt: new Date(), updatedById: session.sub },
    select: loanSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "loan.pay",
    entity: "CompanyLoanRequest",
    entityId: loan.id,
    ...meta,
  });
  return serialize(record);
}

export interface PayrollLoanInstallment {
  loanId: string;
  installment: number;
}

/**
 * This period's loan installment per employee, for every outstanding
 * (status PAID, not yet fully repaid) loan — amount / installmentCount,
 * capped to whatever's actually left owing so the final installment can't
 * overshoot. Feeds payroll/service.ts's generatePayroll() so loan repayment
 * is deducted automatically every run instead of HR retyping an amount by
 * hand each period. An employee can have more than one outstanding loan
 * (e.g. a prior year's loan still repaying when a new one is approved) — all
 * are summed for display but tracked separately so applyPayrollLoanInstallments
 * can credit the right loan(s).
 */
export async function getOutstandingLoansForPayroll(
  companyId: string,
  employeeIds: string[],
): Promise<Map<string, PayrollLoanInstallment[]>> {
  if (employeeIds.length === 0) return new Map();
  const loans = await prisma.companyLoanRequest.findMany({
    where: { companyId, deletedAt: null, employeeId: { in: employeeIds }, status: "PAID" },
    select: { id: true, employeeId: true, amount: true, repaidAmount: true, installmentCount: true },
  });
  const map = new Map<string, PayrollLoanInstallment[]>();
  for (const l of loans) {
    const remaining = Number(l.amount) - Number(l.repaidAmount);
    if (remaining <= 0) continue;
    const perInstallment = Math.round(Number(l.amount) / Math.max(1, l.installmentCount));
    const installment = Math.min(perInstallment, remaining);
    if (installment <= 0) continue;
    const list = map.get(l.employeeId) ?? [];
    list.push({ loanId: l.id, installment });
    map.set(l.employeeId, list);
  }
  return map;
}

export function sumInstallments(list: PayrollLoanInstallment[] | undefined): number {
  return (list ?? []).reduce((s, x) => s + x.installment, 0);
}

/**
 * Credits each installment against its loan's repaidAmount — called once a
 * payslip that included these installments is actually marked PAID (see
 * payroll/service.ts's markPaid()), never at draft-generate time, so a
 * regenerated-but-still-DRAFT payslip never double-credits a repayment.
 * Sequential, not Promise.all — same pooled-connection reasoning used
 * elsewhere in this codebase (connection_limit=1).
 */
export async function applyPayrollLoanInstallments(
  companyId: string,
  session: AccessClaims,
  installments: PayrollLoanInstallment[],
  meta?: Meta,
): Promise<void> {
  for (const { loanId, installment } of installments) {
    const loan = await prisma.companyLoanRequest.findFirst({
      where: { id: loanId, companyId, deletedAt: null },
      select: { repaidAmount: true },
    });
    if (!loan) continue;
    const newRepaid = Number(loan.repaidAmount) + installment;
    await prisma.companyLoanRequest.update({
      where: { id: loanId },
      data: { repaidAmount: new Prisma.Decimal(newRepaid), updatedById: session.sub },
    });
    await writeAudit({
      companyId,
      actorUserId: session.sub,
      action: "loan.repay",
      entity: "CompanyLoanRequest",
      entityId: loanId,
      after: { amount: installment, source: "payroll" },
      ...meta,
    });
  }
}

/** Finance/HR records a repayment against a disbursed loan — a running
 * total only (repaidAmount), not a full installment ledger; see the model's
 * own doc comment for why. */
export async function recordLoanRepayment(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: LoanRepayInput,
  meta?: Meta,
) {
  const loan = await prisma.companyLoanRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, amount: true, repaidAmount: true, status: true },
  });
  if (!loan) throw NotFound("ไม่พบคำขอกู้เงิน");
  if (loan.status !== "PAID") throw BadRequest("บันทึกการผ่อนชำระได้เฉพาะเงินกู้ที่จ่ายแล้ว");

  const newRepaid = Number(loan.repaidAmount) + input.amount;
  if (newRepaid > Number(loan.amount) + 0.01) {
    throw BadRequest(`ยอดผ่อนชำระเกินยอดเงินกู้คงเหลือ (คงเหลือ ${(Number(loan.amount) - Number(loan.repaidAmount)).toFixed(2)} บาท)`);
  }

  const record = await prisma.companyLoanRequest.update({
    where: { id: loan.id },
    data: { repaidAmount: new Prisma.Decimal(newRepaid), updatedById: session.sub },
    select: loanSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "loan.repay",
    entity: "CompanyLoanRequest",
    entityId: loan.id,
    after: { amount: input.amount },
    ...meta,
  });
  return serialize(record);
}

export async function cancelLoan(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const employeeId = requireEmployeeId(session);
  const loan = await prisma.companyLoanRequest.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, status: true },
  });
  if (!loan) throw NotFound("ไม่พบคำขอกู้เงิน");
  if (loan.employeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (loan.status !== "PENDING") throw BadRequest("ยกเลิกได้เฉพาะคำขอที่รออนุมัติ");

  const record = await prisma.companyLoanRequest.update({
    where: { id: loan.id },
    data: { status: "CANCELLED", updatedById: session.sub },
    select: loanSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "loan.cancel",
    entity: "CompanyLoanRequest",
    entityId: loan.id,
    ...meta,
  });
  return serialize(record);
}
