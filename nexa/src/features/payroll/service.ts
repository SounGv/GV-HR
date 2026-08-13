import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { sendEmail } from "@/lib/email";
import { getCompanyProfile } from "@/features/company/service";
import { computePayroll, periodLabel, type LineItem } from "./calc";
import { renderPayslipEmailHtml } from "./payslip-email";
import type { PayrollAdjustInput, PayrollListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const json = (v: unknown) => v as Prisma.InputJsonValue;

interface ManualAdjustments {
  earnings: LineItem[];
  deductions: LineItem[];
}

function readAdjustments(raw: unknown): ManualAdjustments {
  const v = raw as Partial<ManualAdjustments> | null | undefined;
  return { earnings: v?.earnings ?? [], deductions: v?.deductions ?? [] };
}

const recordSelect = {
  id: true,
  period: true,
  periodLabel: true,
  earnings: true,
  deductions: true,
  manualAdjustments: true,
  note: true,
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

const DAY_MS = 86_400_000;

/**
 * Approved unpaid-leave days per employee overlapping [from, to) — clipped to
 * the period for the rare request that spans a payroll cutover (the stored
 * `days` field covers the whole request, not just the part inside this
 * period). Half-day precision isn't preserved across a boundary split; an
 * acceptable simplification for that edge case.
 */
async function getUnpaidLeaveDaysByEmployee(
  companyId: string,
  from: Date,
  to: Date,
  employeeId?: string,
): Promise<Map<string, number>> {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "APPROVED",
      type: "UNPAID",
      startDate: { lt: to },
      endDate: { gte: from },
      ...(employeeId ? { employeeId } : {}),
    },
    select: { employeeId: true, startDate: true, endDate: true, days: true },
  });

  const map = new Map<string, number>();
  for (const r of requests) {
    const fullyInside = r.startDate >= from && r.endDate < to;
    let days: number;
    if (fullyInside) {
      days = r.days;
    } else {
      const clipStart = r.startDate < from ? from : r.startDate;
      const clipEndExclusive = r.endDate >= to ? to : new Date(r.endDate.getTime() + DAY_MS);
      days = Math.max(0, Math.round((clipEndExclusive.getTime() - clipStart.getTime()) / DAY_MS));
    }
    map.set(r.employeeId, (map.get(r.employeeId) ?? 0) + days);
  }
  return map;
}

/**
 * Days-present (any record with a clock-in) and total clocked hours per
 * employee, for DAILY/HOURLY compensation — base pay for those two types is
 * literally rate × actual attendance, unlike MONTHLY which pays the fixed
 * baseSalary regardless (adjusted only by the unpaid-leave deduction above).
 */
async function getWorkedDaysAndHours(
  companyId: string,
  from: Date,
  to: Date,
  employeeIds: string[],
): Promise<Map<string, { days: number; hours: number }>> {
  const recs = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, employeeId: { in: employeeIds }, workDate: { gte: from, lt: to } },
    select: { employeeId: true, clockInAt: true, clockOutAt: true },
  });
  const map = new Map<string, { days: number; hours: number }>();
  for (const r of recs) {
    if (!r.clockInAt) continue;
    const row = map.get(r.employeeId) ?? { days: 0, hours: 0 };
    row.days += 1;
    if (r.clockOutAt) row.hours += (r.clockOutAt.getTime() - r.clockInAt.getTime()) / 3_600_000;
    map.set(r.employeeId, row);
  }
  return map;
}

/** Base pay this period, per the employee's own compensation type. */
function computeBasePay(
  emp: { compensationType: string; baseSalary: unknown; dailyRate: unknown; hourlyRate: unknown },
  worked: { days: number; hours: number } | undefined,
): number {
  if (emp.compensationType === "DAILY") return Number(emp.dailyRate ?? 0) * (worked?.days ?? 0);
  if (emp.compensationType === "HOURLY") return Number(emp.hourlyRate ?? 0) * (worked?.hours ?? 0);
  return Number(emp.baseSalary ?? 0);
}

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

export function canManagePayroll(session: AccessClaims): boolean {
  return can(session.perms, "payroll:create") || can(session.perms, "payroll:approve");
}

export async function getPayrollPeriodStatus(companyId: string, period: string) {
  const closed = await prisma.payrollPeriod.findUnique({
    where: { companyId_period: { companyId, period } },
    select: { closedAt: true },
  });
  return { period, closed: !!closed, closedAt: closed?.closedAt ?? null };
}

async function requirePeriodOpen(companyId: string, period: string) {
  const closed = await prisma.payrollPeriod.findUnique({
    where: { companyId_period: { companyId, period } },
    select: { id: true },
  });
  if (closed) throw BadRequest("งวดนี้ปิดแล้ว ไม่สามารถประมวลผลหรือแก้ไขได้อีก");
}

/**
 * Close a payroll period company-wide — blocks generate/adjust for every
 * record in that period from this point on, including brand-new employees
 * added later (unlike the existing per-record PAID lock, which only protects
 * records already marked paid). Same authority level as marking a payslip
 * paid, so it reuses `payroll:approve` rather than a new permission action.
 */
export async function closePayrollPeriod(
  companyId: string,
  session: AccessClaims,
  period: string,
  meta?: Meta,
) {
  const existing = await prisma.payrollPeriod.findUnique({
    where: { companyId_period: { companyId, period } },
    select: { id: true },
  });
  if (existing) throw BadRequest("งวดนี้ปิดไปแล้ว");

  await prisma.payrollPeriod.create({
    data: { companyId, period, closedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "payroll.close_period",
    entity: "PayrollPeriod",
    after: { period },
    ...meta,
  });

  return getPayrollPeriodStatus(companyId, period);
}

/** Generate/refresh DRAFT payslips for all active salaried employees in a period. */
export async function generatePayroll(
  companyId: string,
  session: AccessClaims,
  period: string,
  meta?: Meta,
) {
  await requirePeriodOpen(companyId, period);

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        { compensationType: "MONTHLY", baseSalary: { not: null } },
        { compensationType: "DAILY", dailyRate: { not: null } },
        { compensationType: "HOURLY", hourlyRate: { not: null } },
      ],
    },
    select: { id: true, compensationType: true, baseSalary: true, dailyRate: true, hourlyRate: true },
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
  const unpaidLeaveMap = await getUnpaidLeaveDaysByEmployee(companyId, from, to);
  const wagedIds = employees.filter((e) => e.compensationType !== "MONTHLY").map((e) => e.id);
  const workedMap =
    wagedIds.length > 0 ? await getWorkedDaysAndHours(companyId, from, to, wagedIds) : new Map();

  // Existing records for this period — read so a re-generate (e.g. after new
  // OT gets approved) never wipes HR's manual adjustments, and never touches
  // a payslip that's already been marked PAID.
  const existing = await prisma.payrollRecord.findMany({
    where: { companyId, period, employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true, status: true, manualAdjustments: true },
  });
  const existingMap = new Map(existing.map((r) => [r.employeeId, r]));

  let count = 0;

  for (const emp of employees) {
    const prior = existingMap.get(emp.id);
    if (prior?.status === "PAID") continue; // never recompute a finalized payslip

    const adj = readAdjustments(prior?.manualAdjustments);
    const isMonthly = emp.compensationType === "MONTHLY";
    const comp = computePayroll({
      baseSalary: computeBasePay(emp, workedMap.get(emp.id)),
      compensationType: emp.compensationType as "MONTHLY" | "DAILY" | "HOURLY",
      overtime: otMap.get(emp.id) ?? 0,
      // Unpaid leave only makes sense to deduct for MONTHLY — DAILY/HOURLY
      // base pay already excludes unworked days/hours by construction.
      unpaidLeaveDays: isMonthly ? unpaidLeaveMap.get(emp.id) ?? 0 : 0,
      extraEarnings: adj.earnings,
      extraDeductions: adj.deductions,
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
 * HR adds/edits ad-hoc earnings & deductions on a DRAFT payslip (allowance,
 * bonus, salary advance recovery, other) — recomputes the full payslip
 * (salary + approved OT for the period + these adjustments) so gross/net
 * stay consistent. Only allowed before the payslip is marked PAID.
 */
export async function updatePayrollAdjustments(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: PayrollAdjustInput,
  meta?: Meta,
) {
  const record = await prisma.payrollRecord.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, period: true, periodLabel: true, status: true },
  });
  if (!record) throw NotFound("ไม่พบสลิปเงินเดือน");
  if (record.status === "PAID") throw BadRequest("แก้ไขไม่ได้ — รายการนี้จ่ายแล้ว");
  await requirePeriodOpen(companyId, record.period);

  const employee = await prisma.employee.findFirst({
    where: { id: record.employeeId, companyId, deletedAt: null },
    select: { compensationType: true, baseSalary: true, dailyRate: true, hourlyRate: true },
  });
  if (!employee) throw NotFound("ไม่พบข้อมูลพนักงาน");
  const hasRate =
    (employee.compensationType === "MONTHLY" && employee.baseSalary != null) ||
    (employee.compensationType === "DAILY" && employee.dailyRate != null) ||
    (employee.compensationType === "HOURLY" && employee.hourlyRate != null);
  if (!hasRate) throw BadRequest("พนักงานยังไม่ได้ตั้งอัตราค่าจ้างสำหรับประเภทการจ้างนี้");

  const [y, m] = record.period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const otAgg = await prisma.overtimeRequest.aggregate({
    where: { companyId, employeeId: record.employeeId, deletedAt: null, status: "APPROVED", date: { gte: from, lt: to } },
    _sum: { estimatedAmount: true },
  });
  const isMonthly = employee.compensationType === "MONTHLY";
  const unpaidLeaveMap = isMonthly
    ? await getUnpaidLeaveDaysByEmployee(companyId, from, to, record.employeeId)
    : new Map<string, number>();
  const workedMap = isMonthly
    ? new Map<string, { days: number; hours: number }>()
    : await getWorkedDaysAndHours(companyId, from, to, [record.employeeId]);

  const adjustments: ManualAdjustments = {
    earnings: input.extraEarnings ?? [],
    deductions: input.extraDeductions ?? [],
  };
  const comp = computePayroll({
    baseSalary: computeBasePay(employee, workedMap.get(record.employeeId)),
    compensationType: employee.compensationType as "MONTHLY" | "DAILY" | "HOURLY",
    overtime: otAgg._sum.estimatedAmount ?? 0,
    unpaidLeaveDays: unpaidLeaveMap.get(record.employeeId) ?? 0,
    extraEarnings: adjustments.earnings,
    extraDeductions: adjustments.deductions,
  });

  const updated = await prisma.payrollRecord.update({
    where: { id: record.id },
    data: {
      earnings: json(comp.earnings),
      deductions: json(comp.deductions),
      manualAdjustments: json(adjustments),
      note: input.note ?? null,
      gross: comp.gross,
      totalDeductions: comp.totalDeductions,
      net: comp.net,
      updatedById: session.sub,
    },
    select: recordWithEmployeeSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "payroll.adjust",
    entity: "PayrollRecord",
    entityId: record.id,
    after: { extraEarnings: adjustments.earnings, extraDeductions: adjustments.deductions },
    ...meta,
  });

  return updated;
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
        note: record.note,
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
