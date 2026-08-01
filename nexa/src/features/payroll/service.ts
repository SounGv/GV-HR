import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computePayroll, periodLabel } from "./calc";
import type { PayrollListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const json = (v: unknown) => v as Prisma.InputJsonValue;

const recordSelect = {
  id: true,
  period: true,
  periodLabel: true,
  earnings: true,
  deductions: true,
  gross: true,
  totalDeductions: true,
  net: true,
  status: true,
  paidAt: true,
} satisfies Prisma.PayrollRecordSelect;

const recordWithEmployeeSelect = {
  ...recordSelect,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.PayrollRecordSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

export function canManagePayroll(session: AccessClaims): boolean {
  return can(session.perms, "payroll:create") || can(session.perms, "payroll:approve");
}

/** Generate/refresh DRAFT payslips for all active salaried employees in a period. */
export async function generatePayroll(
  companyId: string,
  session: AccessClaims,
  period: string,
  meta?: Meta,
) {
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE", baseSalary: { not: null } },
    select: { id: true, baseSalary: true },
  });
  const label = periodLabel(period);

  // Auto-include approved overtime for the period into each payslip.
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const otAgg = await prisma.overtimeRequest.groupBy({
    by: ["employeeId"],
    where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: from, lt: to } },
    _sum: { estimatedAmount: true },
  });
  const otMap = new Map(otAgg.map((o) => [o.employeeId, o._sum.estimatedAmount ?? 0]));

  let count = 0;

  for (const emp of employees) {
    const comp = computePayroll({
      baseSalary: Number(emp.baseSalary),
      overtime: otMap.get(emp.id) ?? 0,
    });
    await prisma.payrollRecord.upsert({
      where: { employeeId_period: { employeeId: emp.id, period } },
      update: {
        periodLabel: label,
        earnings: json(comp.earnings),
        deductions: json(comp.deductions),
        gross: comp.gross,
        totalDeductions: comp.totalDeductions,
        net: comp.net,
        updatedById: session.sub,
      },
      create: {
        companyId,
        employeeId: emp.id,
        period,
        periodLabel: label,
        earnings: json(comp.earnings),
        deductions: json(comp.deductions),
        gross: comp.gross,
        totalDeductions: comp.totalDeductions,
        net: comp.net,
        status: "DRAFT",
        createdById: session.sub,
        updatedById: session.sub,
      },
    });
    count++;
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "payroll.generate",
    entity: "PayrollRecord",
    after: { period, count },
    ...meta,
  });

  return { period, periodLabel: label, count };
}

export async function listPayroll(
  companyId: string,
  session: AccessClaims,
  query: PayrollListQuery,
) {
  if (query.scope === "me") {
    const employeeId = requireEmployeeId(session);
    return prisma.payrollRecord.findMany({
      where: { companyId, deletedAt: null, employeeId, ...(query.period ? { period: query.period } : {}) },
      select: recordSelect,
      orderBy: { period: "desc" },
      take: 60,
    });
  }
  // Company-wide (caller must hold manage permission — enforced in the route).
  return prisma.payrollRecord.findMany({
    where: { companyId, deletedAt: null, ...(query.period ? { period: query.period } : {}) },
    select: recordWithEmployeeSelect,
    orderBy: [{ period: "desc" }, { net: "desc" }],
    take: 500,
  });
}

export async function getPayslip(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.payrollRecord.findFirst({
    where: { id, companyId, deletedAt: null },
    select: recordWithEmployeeSelect,
  });
  if (!record) throw NotFound("ไม่พบสลิปเงินเดือน");
  if (record.employee.id !== session.employeeId && !canManagePayroll(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูสลิปนี้");
  }
  return record;
}

export async function markPaid(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const record = await prisma.payrollRecord.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!record) throw NotFound("ไม่พบสลิปเงินเดือน");
  if (record.status === "PAID") throw BadRequest("รายการนี้จ่ายแล้ว");

  const updated = await prisma.payrollRecord.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), updatedById: session.sub },
    select: recordWithEmployeeSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "payroll.pay",
    entity: "PayrollRecord",
    entityId: id,
    ...meta,
  });

  return updated;
}
