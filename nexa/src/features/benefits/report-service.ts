import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMedicalExpenseCap } from "@/features/expense/service";

export interface BenefitsReportFilters {
  year?: number;
  employeeId?: string;
  departmentId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface MedicalReportRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  totalCap: number;
  claimCount: number;
  approvedTotal: number;
  pendingTotal: number;
  remaining: number;
  lastClaimDate: string | null;
  attachments: string[];
  sickLeaveRefs: string[];
}

/** One row per employee who has at least one medical claim in scope,
 * aggregating amounts the way the spec's report table describes (not one
 * row per claim — "วงเงินทั้งหมด/จำนวนครั้งที่เบิก/ยอดอนุมัติสะสม" are all
 * per-employee totals). */
export async function getMedicalBenefitsReport(companyId: string, filters: BenefitsReportFilters): Promise<MedicalReportRow[]> {
  const year = filters.year ?? new Date().getFullYear();
  const cap = await getMedicalExpenseCap(companyId);

  const claims = await prisma.expenseClaim.findMany({
    where: {
      companyId,
      category: "medical",
      deletedAt: null,
      expenseDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.status ? { status: filters.status as Prisma.ExpenseClaimWhereInput["status"] } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            expenseDate: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    select: {
      employeeId: true,
      amount: true,
      status: true,
      expenseDate: true,
      receiptUrl: true,
      sickLeaveRequestId: true,
      employee: {
        select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      },
    },
    orderBy: { expenseDate: "desc" },
  });

  const byEmployee = new Map<string, MedicalReportRow>();
  for (const c of claims) {
    let row = byEmployee.get(c.employeeId);
    if (!row) {
      row = {
        employeeId: c.employeeId,
        employeeCode: c.employee.employeeCode,
        employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
        department: c.employee.department?.name ?? null,
        totalCap: cap,
        claimCount: 0,
        approvedTotal: 0,
        pendingTotal: 0,
        remaining: cap,
        lastClaimDate: null,
        attachments: [],
        sickLeaveRefs: [],
      };
      byEmployee.set(c.employeeId, row);
    }
    row.claimCount += 1;
    const amount = Number(c.amount);
    if (c.status === "APPROVED" || c.status === "PAID") row.approvedTotal += amount;
    if (c.status === "PENDING") row.pendingTotal += amount;
    if (!row.lastClaimDate || c.expenseDate.toISOString() > row.lastClaimDate) row.lastClaimDate = c.expenseDate.toISOString();
    if (c.receiptUrl) row.attachments.push(c.receiptUrl);
    if (c.sickLeaveRequestId) row.sickLeaveRefs.push(c.sickLeaveRequestId);
  }
  for (const row of byEmployee.values()) {
    row.remaining = Math.max(0, row.totalCap - row.approvedTotal - row.pendingTotal);
  }
  return [...byEmployee.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export interface LoanReportRow {
  loanId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  salarySnapshot: number;
  amount: number;
  loanDate: string;
  status: string;
  usageCountThisYear: number;
  outstanding: number;
}

/** One row per loan request (not aggregated) — matches the spec's loan
 * report table exactly ("วันที่กู้", "สถานะ" per request). */
export async function getLoanBenefitsReport(companyId: string, filters: BenefitsReportFilters): Promise<LoanReportRow[]> {
  const year = filters.year;
  const loans = await prisma.companyLoanRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(year ? { year } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.status ? { status: filters.status as Prisma.CompanyLoanRequestWhereInput["status"] } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    },
    select: {
      id: true,
      employeeId: true,
      year: true,
      salarySnapshot: true,
      amount: true,
      createdAt: true,
      status: true,
      repaidAmount: true,
      employee: {
        select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // "จำนวนครั้งที่ใช้สิทธิ์ในปีนั้น" — count active (non-rejected/cancelled)
  // loan requests per employee+year across the whole filtered set.
  const usageCount = new Map<string, number>();
  for (const l of loans) {
    if (l.status === "REJECTED" || l.status === "CANCELLED") continue;
    const key = `${l.employeeId}:${l.year}`;
    usageCount.set(key, (usageCount.get(key) ?? 0) + 1);
  }

  return loans.map((l) => ({
    loanId: l.id,
    employeeId: l.employeeId,
    employeeCode: l.employee.employeeCode,
    employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
    department: l.employee.department?.name ?? null,
    salarySnapshot: Number(l.salarySnapshot),
    amount: Number(l.amount),
    loanDate: l.createdAt.toISOString(),
    status: l.status,
    usageCountThisYear: usageCount.get(`${l.employeeId}:${l.year}`) ?? 0,
    outstanding: Number(l.amount) - Number(l.repaidAmount),
  }));
}
