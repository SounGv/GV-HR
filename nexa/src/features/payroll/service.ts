import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { sendEmail } from "@/lib/email";
import { getCompanyProfile } from "@/features/company/service";
import { computePayroll, periodLabel, type LineItem, type TaxDeductionInputs } from "./calc";
import { renderPayslipEmailHtml } from "./payslip-email";
import {
  getOutstandingLoansForPayroll,
  sumInstallments,
  applyPayrollLoanInstallments,
} from "@/features/company-loan/service";
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

/** Map an employee's declared tax-deduction fields onto computePayroll()'s input shape. */
function toTaxDeductions(emp: {
  taxSpouseNoIncome: boolean;
  taxChildrenStandard: number;
  taxChildrenEnhanced: number;
  taxParentCareCount: number;
  taxLifeInsurance: Prisma.Decimal;
  taxHealthInsurance: Prisma.Decimal;
}): TaxDeductionInputs {
  return {
    spouseNoIncome: emp.taxSpouseNoIncome,
    childrenStandard: emp.taxChildrenStandard,
    childrenEnhanced: emp.taxChildrenEnhanced,
    parentCareCount: emp.taxParentCareCount,
    lifeInsurance: Number(emp.taxLifeInsurance),
    healthInsurance: Number(emp.taxHealthInsurance),
  };
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
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      email: true,
      departmentId: true,
      nationalId: true,
      bankName: true,
      bankAccountNo: true,
    },
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

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Per-employee absence/lateness for MONTHLY employees over [from, to),
 * mirroring the day-status derivation already used by the "my calendar"
 * view (features/calendar/service.ts): a Mon–Fri day is a candidate only
 * if it isn't a company holiday, isn't covered by any APPROVED leave
 * (any type), and isn't still in the future. Lateness reuses the
 * AttendanceRecord "LATE" status already set at clock-in time
 * (lib/datetime.ts) rather than re-deriving it against shift times here.
 *
 * A day with no AttendanceRecord at all is NOT auto-counted as an absence —
 * there is no confirmed-absent signal anywhere in this app today; "no
 * record" only ever means nobody's clocked in yet or the punch was never
 * imported. Treating that as absence auto-deducted real pay for a day HR
 * never actually reviewed. Those days land in `pendingReviewDays` instead
 * (zero deduction) so payroll/reports can flag them for a human to check —
 * confirming a genuine unexcused absence, if HR wants it deducted, still
 * goes through the existing manual extraDeductions adjustment.
 */
async function getAbsenceAndLateByEmployee(
  companyId: string,
  from: Date,
  to: Date,
  employeeIds: string[],
): Promise<Map<string, { absentDays: number; pendingReviewDays: number; lateOccurrences: number }>> {
  const [holidays, leaves, records] = [
    await prisma.holiday.findMany({
      where: { companyId, deletedAt: null, date: { gte: from, lt: to } },
      select: { date: true },
    }),
    await prisma.leaveRequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "APPROVED",
        employeeId: { in: employeeIds },
        startDate: { lt: to },
        endDate: { gte: from },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
    await prisma.attendanceRecord.findMany({
      where: { companyId, deletedAt: null, employeeId: { in: employeeIds }, workDate: { gte: from, lt: to } },
      select: { employeeId: true, workDate: true, clockInAt: true, status: true },
    }),
  ];

  const holidaySet = new Set(holidays.map((h) => iso(h.date)));
  const leavesByEmployee = new Map<string, { startDate: Date; endDate: Date }[]>();
  for (const l of leaves) {
    const list = leavesByEmployee.get(l.employeeId) ?? [];
    list.push(l);
    leavesByEmployee.set(l.employeeId, list);
  }
  const recordByKey = new Map(records.map((r) => [`${r.employeeId}|${iso(r.workDate)}`, r]));
  const todayIso = iso(new Date());

  const result = new Map<string, { absentDays: number; pendingReviewDays: number; lateOccurrences: number }>();
  for (const employeeId of employeeIds) {
    const myLeaves = leavesByEmployee.get(employeeId) ?? [];
    let pendingReviewDays = 0;
    let lateOccurrences = 0;
    for (let cur = new Date(from); cur.getTime() < to.getTime(); cur = new Date(cur.getTime() + DAY_MS)) {
      const curIso = iso(cur);
      if (curIso > todayIso) continue; // hasn't happened yet — not absent, not pending
      const weekday = cur.getUTCDay();
      if (weekday === 0 || weekday === 6) continue; // weekend
      if (holidaySet.has(curIso)) continue;
      const onLeave = myLeaves.some((l) => l.startDate.getTime() <= cur.getTime() && cur.getTime() <= l.endDate.getTime());
      if (onLeave) continue;
      const rec = recordByKey.get(`${employeeId}|${curIso}`);
      if (!rec?.clockInAt) {
        pendingReviewDays += 1;
      } else if (rec.status === "LATE") {
        lateOccurrences += 1;
      }
    }
    // absentDays stays 0 automatically — no code path today confirms a real
    // unexcused absence; see doc comment above.
    result.set(employeeId, { absentDays: 0, pendingReviewDays, lateOccurrences });
  }
  return result;
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
    select: {
      id: true,
      compensationType: true,
      baseSalary: true,
      dailyRate: true,
      hourlyRate: true,
      taxSpouseNoIncome: true,
      taxChildrenStandard: true,
      taxChildrenEnhanced: true,
      taxParentCareCount: true,
      taxLifeInsurance: true,
      taxHealthInsurance: true,
    },
  });
  const label = periodLabel(period);

  // Auto-include approved overtime for the period into each payslip.
  // paidAt: null excludes OT already credited to a payslip that's since been
  // marked PAID — belt-and-suspenders alongside the existing "never
  // recompute a PAID payslip" guard below (see markPaid() for where paidAt
  // gets stamped).
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const otAgg = await prisma.overtimeRequest.groupBy({
    by: ["employeeId"],
    where: { companyId, deletedAt: null, status: "APPROVED", paidAt: null, date: { gte: from, lt: to } },
    _sum: { estimatedAmount: true },
  });
  const otMap = new Map(otAgg.map((o) => [o.employeeId, o._sum.estimatedAmount ?? 0]));
  const unpaidLeaveMap = await getUnpaidLeaveDaysByEmployee(companyId, from, to);
  const wagedIds = employees.filter((e) => e.compensationType !== "MONTHLY").map((e) => e.id);
  const workedMap =
    wagedIds.length > 0 ? await getWorkedDaysAndHours(companyId, from, to, wagedIds) : new Map();

  const attendancePolicy = await prisma.company.findUnique({
    where: { id: companyId },
    select: { attendanceDeductionEnabled: true, lateDeductionPerOccurrence: true },
  });
  const monthlyIds = employees.filter((e) => e.compensationType === "MONTHLY").map((e) => e.id);
  const absenceMap =
    attendancePolicy?.attendanceDeductionEnabled && monthlyIds.length > 0
      ? await getAbsenceAndLateByEmployee(companyId, from, to, monthlyIds)
      : new Map<string, { absentDays: number; pendingReviewDays: number; lateOccurrences: number }>();
  // Auto-deduct this period's loan installment for anyone with an
  // outstanding company loan — see company-loan/service.ts's
  // getOutstandingLoansForPayroll() doc comment.
  const loanMap = await getOutstandingLoansForPayroll(companyId, employees.map((e) => e.id));

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
      absentDays: absenceMap.get(emp.id)?.absentDays ?? 0,
      pendingReviewDays: absenceMap.get(emp.id)?.pendingReviewDays ?? 0,
      lateOccurrences: absenceMap.get(emp.id)?.lateOccurrences ?? 0,
      lateDeductionPerOccurrence: Number(attendancePolicy?.lateDeductionPerOccurrence ?? 0),
      loan: sumInstallments(loanMap.get(emp.id)),
      extraEarnings: adj.earnings,
      extraDeductions: adj.deductions,
      taxDeductions: toTaxDeductions(emp),
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
    select: {
      compensationType: true,
      baseSalary: true,
      dailyRate: true,
      hourlyRate: true,
      taxSpouseNoIncome: true,
      taxChildrenStandard: true,
      taxChildrenEnhanced: true,
      taxParentCareCount: true,
      taxLifeInsurance: true,
      taxHealthInsurance: true,
    },
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

  const attendancePolicy = await prisma.company.findUnique({
    where: { id: companyId },
    select: { attendanceDeductionEnabled: true, lateDeductionPerOccurrence: true },
  });
  const absenceMap =
    isMonthly && attendancePolicy?.attendanceDeductionEnabled
      ? await getAbsenceAndLateByEmployee(companyId, from, to, [record.employeeId])
      : new Map<string, { absentDays: number; lateOccurrences: number }>();
  // Same auto-loan-deduction the DRAFT generator applies (generatePayroll,
  // above) — without this, editing/importing adjustments on top of an
  // already-generated payslip silently drops the loan installment line.
  const loanMap = await getOutstandingLoansForPayroll(companyId, [record.employeeId]);

  const adjustments: ManualAdjustments = {
    earnings: input.extraEarnings ?? [],
    deductions: input.extraDeductions ?? [],
  };
  const comp = computePayroll({
    baseSalary: computeBasePay(employee, workedMap.get(record.employeeId)),
    compensationType: employee.compensationType as "MONTHLY" | "DAILY" | "HOURLY",
    overtime: otAgg._sum.estimatedAmount ?? 0,
    unpaidLeaveDays: unpaidLeaveMap.get(record.employeeId) ?? 0,
    absentDays: absenceMap.get(record.employeeId)?.absentDays ?? 0,
    lateOccurrences: absenceMap.get(record.employeeId)?.lateOccurrences ?? 0,
    lateDeductionPerOccurrence: Number(attendancePolicy?.lateDeductionPerOccurrence ?? 0),
    loan: sumInstallments(loanMap.get(record.employeeId)),
    extraEarnings: adjustments.earnings,
    extraDeductions: adjustments.deductions,
    taxDeductions: toTaxDeductions(employee),
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
    select: { id: true, status: true, employeeId: true, period: true },
  });
  if (!record) throw NotFound("ไม่พบสลิปเงินเดือน");
  if (record.status === "PAID") throw BadRequest("รายการนี้จ่ายแล้ว");

  const updated = await prisma.payrollRecord.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), updatedById: session.sub },
    select: recordWithEmployeeSelect,
  });

  // Finalize the two auto-computed lines this payslip pulled in live at
  // generate time — from here on they're locked in as actually paid, so a
  // later payroll run for a different period can't pull the same OT/loan
  // installment in again.
  const [y, m] = record.period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  await prisma.overtimeRequest.updateMany({
    where: { companyId, employeeId: record.employeeId, status: "APPROVED", paidAt: null, date: { gte: from, lt: to } },
    data: { paidAt: new Date() },
  });
  const loanMap = await getOutstandingLoansForPayroll(companyId, [record.employeeId]);
  const installments = loanMap.get(record.employeeId);
  if (installments?.length) {
    await applyPayrollLoanInstallments(companyId, session, installments, meta);
  }

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
