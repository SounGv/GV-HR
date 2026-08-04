import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { sendEmail } from "@/lib/email";
import { getCompanyProfile } from "@/features/company/service";
import { computePayroll, periodLabel } from "./calc";
import { renderPayslipEmailHtml } from "./payslip-email";
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
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true, email: true, departmentId: true },
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
    where: {
      companyId,
      deletedAt: null,
      ...(query.period ? { period: query.period } : {}),
      ...(query.departmentId || query.search
        ? {
            employee: {
              ...(query.departmentId ? { departmentId: query.departmentId } : {}),
              ...(query.search
                ? {
                    OR: [
                      { firstName: { contains: query.search, mode: "insensitive" } },
                      { lastName: { contains: query.search, mode: "insensitive" } },
                      { nickname: { contains: query.search, mode: "insensitive" } },
                      { employeeCode: { contains: query.search, mode: "insensitive" } },
                      { email: { contains: query.search, mode: "insensitive" } },
                    ],
                  }
                : {}),
            },
          }
        : {}),
    },
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

/**
 * Public payslip verification (no auth). Returns only non-sensitive fields to
 * confirm authenticity — never salary amounts. `id` is an unguessable UUID.
 */
export async function verifyPayslip(id: string) {
  const rec = await prisma.payrollRecord.findFirst({
    where: { id, deletedAt: null },
    select: {
      periodLabel: true,
      status: true,
      paidAt: true,
      createdAt: true,
      company: { select: { name: true, legalName: true } },
      employee: { select: { employeeCode: true, firstName: true, lastName: true } },
    },
  });
  if (!rec) return null;
  return {
    valid: true,
    company: rec.company.legalName ?? rec.company.name,
    employeeCode: rec.employee.employeeCode,
    name: `${rec.employee.firstName} ${rec.employee.lastName}`.trim(),
    period: rec.periodLabel,
    status: rec.status,
    issuedAt: (rec.paidAt ?? rec.createdAt).toISOString(),
  };
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

/**
 * Emails each selected payslip as a full HTML statement (no PDF generation
 * exists server-side today — see payslip-email.ts). Employees without an
 * email on file are skipped, not failed, so one missing address doesn't
 * block the rest of the batch.
 */
export async function sendPayslipEmails(
  companyId: string,
  session: AccessClaims,
  payrollRecordIds: string[],
  verifyBaseUrl: string,
  meta?: Meta,
) {
  const records = await prisma.payrollRecord.findMany({
    where: { id: { in: payrollRecordIds }, companyId, deletedAt: null },
    select: recordWithEmployeeSelect,
  });
  if (records.length === 0) throw NotFound("ไม่พบสลิปเงินเดือนที่เลือก");

  const company = await getCompanyProfile(companyId);

  const sent: string[] = [];
  const skipped: { employeeId: string; name: string; reason: string }[] = [];

  for (const record of records) {
    const name = `${record.employee.firstName} ${record.employee.lastName}`.trim();
    if (!record.employee.email) {
      skipped.push({ employeeId: record.employee.id, name, reason: "ไม่มีอีเมล" });
      continue;
    }

    const html = renderPayslipEmailHtml({
      record: {
        id: record.id,
        periodLabel: record.periodLabel,
        earnings: record.earnings as unknown as { label: string; amount: number }[],
        deductions: record.deductions as unknown as { label: string; amount: number }[],
        gross: record.gross,
        totalDeductions: record.totalDeductions,
        net: record.net,
        status: record.status,
        employee: { employeeCode: record.employee.employeeCode, firstName: record.employee.firstName, lastName: record.employee.lastName },
      },
      company: { name: company.name, legalName: company.legalName, taxId: company.taxId, addressLine: company.addressLine, subDistrict: company.subDistrict, district: company.district, province: company.province, postalCode: company.postalCode, phone: company.phone },
      verifyUrl: `${verifyBaseUrl}/verify/payslip/${record.id}`,
    });

    await sendEmail({ to: record.employee.email, subject: `สลิปเงินเดือน ${record.periodLabel}`, html });
    sent.push(record.employee.id);
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "payroll.send_email",
    entity: "PayrollRecord",
    after: { sent: sent.length, skipped: skipped.length },
    ...meta,
  });

  return { sent, skipped };
}
