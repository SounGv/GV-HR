import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RequestStep } from "@/features/workflow/types";
import { getRemainingBalance, isCompanyLeaveQuotaConfigured, isDailyCompensation } from "@/features/leave/service";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";

/** The three paid leave types that actually deduct an annual quota (see `deductsBalance`) — UNPAID/OTHER have no meaningful "remaining" to show. */
const LEAVE_TYPES_FOR_SUMMARY = ["ANNUAL", "SICK", "PERSONAL"] as const;

export interface DashboardActions {
  approvals: { leave: number; overtime: number; expense: number; workflow: number };
  myPending: number;
  /** All of my own leave/OT/expense/workflow requests, any status — for a
   * "how many have I filed" glance stat, distinct from myPending's "how many
   * still need a decision" (mobile Home's "สรุปของฉัน"/"คำขอของฉัน" tile). */
  myTotal: number;
  shiftToday: { name: string; startTime: string; endTime: string } | null;
}

/**
 * "What needs my attention" — pending approvals routed to me (as a manager /
 * role-based approver) plus my own open items. Company-scoped and role-aware,
 * so the dashboard adapts to whoever is viewing it.
 */
export async function getActionCenter(
  companyId: string,
  employeeId: string | null,
  roles: string[],
): Promise<DashboardActions> {
  const reportIds = employeeId
    ? (
        await prisma.employee.findMany({
          where: { companyId, managerId: employeeId, deletedAt: null },
          select: { id: true },
        })
      ).map((r) => r.id)
    : [];

  const hasReports = reportIds.length > 0;
  const reportFilter = { companyId, deletedAt: null, status: "PENDING" as const };

  const todayUtc = (() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  })();

  // Sequential, not Promise.all — this app's pooled connection runs with
  // connection_limit=1, where concurrent Prisma calls can throw P2024
  // instead of all completing (same reasoning documented at every other
  // call site in this codebase).
  const leave = hasReports
    ? await prisma.leaveRequest.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
    : 0;
  const overtime = hasReports
    ? await prisma.overtimeRequest.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
    : 0;
  const expense = hasReports
    ? await prisma.expenseClaim.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
    : 0;
  const pendingRequests = await prisma.approvalRequest.findMany({
    where: { companyId, status: "PENDING" },
    select: { steps: true, currentStep: true, requesterEmployeeId: true },
    take: 300,
  });
  const myLeave = employeeId
    ? await prisma.leaveRequest.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
    : 0;
  const myOvertime = employeeId
    ? await prisma.overtimeRequest.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
    : 0;
  const myExpense = employeeId
    ? await prisma.expenseClaim.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
    : 0;
  const myWorkflow = employeeId
    ? await prisma.approvalRequest.count({
        where: { companyId, status: "PENDING", requesterEmployeeId: employeeId },
      })
    : 0;
  const myLeaveTotal = employeeId
    ? await prisma.leaveRequest.count({ where: { companyId, deletedAt: null, employeeId } })
    : 0;
  const myOvertimeTotal = employeeId
    ? await prisma.overtimeRequest.count({ where: { companyId, deletedAt: null, employeeId } })
    : 0;
  const myExpenseTotal = employeeId
    ? await prisma.expenseClaim.count({ where: { companyId, deletedAt: null, employeeId } })
    : 0;
  const myWorkflowTotal = employeeId
    ? await prisma.approvalRequest.count({ where: { companyId, requesterEmployeeId: employeeId } })
    : 0;
  const shift = employeeId
    ? await prisma.shiftAssignment.findUnique({
        where: { employeeId_date: { employeeId, date: todayUtc } },
        select: { template: { select: { name: true, startTime: true, endTime: true } } },
      })
    : null;

  const roleSet = new Set(roles);
  const workflow = pendingRequests.filter((r) => {
    if (r.requesterEmployeeId === employeeId) return false;
    const steps = (r.steps as unknown as RequestStep[]) ?? [];
    const step = steps[r.currentStep];
    return step ? roleSet.has(step.approverRole) : false;
  }).length;

  return {
    approvals: { leave, overtime, expense, workflow },
    myPending: myLeave + myOvertime + myExpense + myWorkflow,
    myTotal: myLeaveTotal + myOvertimeTotal + myExpenseTotal + myWorkflowTotal,
    shiftToday: shift?.template ?? null,
  };
}

export interface LeaveBalanceSummary {
  type: string;
  label: string;
  remaining: number;
  /** False when `remaining` is just the historical system fallback (10/30/3)
   * because HR hasn't configured a real day-quota yet — see leave/service.ts. */
  configured: boolean;
}

export interface MySnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveBalances: LeaveBalanceSummary[];
  latestPayslip: { periodLabel: string; net: number } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

/**
 * Personal "for me" snapshot shown on the dashboard — today's clock status,
 * remaining leave balance, latest payslip, and recognition tally. Company-wide
 * KPIs above are abstract to an individual contributor; this is the part of
 * the dashboard that's actually about them.
 */
export async function getMySnapshot(companyId: string, employeeId: string): Promise<MySnapshot> {
  const year = new Date().getFullYear();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Sequential, not Promise.all — connection_limit=1 (see getActionCenter above).
  const today = await prisma.attendanceRecord.findFirst({
    where: { companyId, employeeId, workDate: todayStart, deletedAt: null },
    select: { clockInAt: true, clockOutAt: true },
  });
  // Daily-wage employees show a real, deliberate 0 (not "not configured") —
  // see leave/service.ts's isDailyCompensation.
  const isDaily = await isDailyCompensation(employeeId);
  const daysConfigured = isDaily ? true : await isCompanyLeaveQuotaConfigured(companyId);
  const leaveBalances: LeaveBalanceSummary[] = [];
  for (const type of LEAVE_TYPES_FOR_SUMMARY) {
    leaveBalances.push({
      type,
      label: LEAVE_TYPE_LABEL[type],
      remaining: await getRemainingBalance(companyId, employeeId, type, year),
      configured: daysConfigured,
    });
  }
  const latestPayslip = await prisma.payrollRecord.findFirst({
    where: { companyId, employeeId },
    orderBy: { period: "desc" },
    select: { periodLabel: true, net: true },
  });
  const recognitionRows = await prisma.recognition.groupBy({
    by: ["type"],
    where: { companyId, employeeId, deletedAt: null },
    _count: { _all: true },
    _sum: { points: true },
  });

  const recognition = { star: 0, award: 0, heart: 0, point: 0 };
  for (const row of recognitionRows) {
    if (row.type === "STAR") recognition.star = row._count._all;
    else if (row.type === "AWARD") recognition.award = row._count._all;
    else if (row.type === "HEART") recognition.heart = row._count._all;
    else if (row.type === "POINT") recognition.point = row._sum.points ?? 0;
  }

  return {
    clockInAt: today?.clockInAt?.toISOString() ?? null,
    clockOutAt: today?.clockOutAt?.toISOString() ?? null,
    leaveBalances,
    latestPayslip: latestPayslip ? { periodLabel: latestPayslip.periodLabel, net: Number(latestPayslip.net) } : null,
    recognition,
  };
}

export interface DashboardSummary {
  headcount: number;
  active: number;
  onLeave: number;
  newThisMonth: number;
  presentToday: number;
  lateToday: number;
  onLeaveToday: number;
  otHoursToday: number;
  attendanceRate: number; // % of active present today
  byDepartment: { name: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byEmploymentType: { type: string; count: number }[];
}

/**
 * Real, company-scoped headcount analytics derived from the Employee table.
 * `employeeWhere` narrows every count/query down to a subset of employees —
 * used only by the AI Assistant's scoped access (see `src/lib/ai/scope.ts`);
 * the real dashboard page never passes it, so its behavior is unchanged.
 */
export async function getDashboardSummary(
  companyId: string,
  employeeWhere?: Prisma.EmployeeWhereInput,
): Promise<DashboardSummary> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const activeFilter = { companyId, deletedAt: null, ...(employeeWhere ?? {}) };

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  // Only resolved when scoped — the unscoped (real dashboard) path never
  // needs a concrete id list since it filters attendance/leave/OT by
  // companyId alone.
  const scopedIds = employeeWhere
    ? (await prisma.employee.findMany({ where: activeFilter, select: { id: true } })).map((e) => e.id)
    : null;
  const employeeIdFilter = scopedIds ? { employeeId: { in: scopedIds } } : {};

  // Sequential, not Promise.all — connection_limit=1 (see getActionCenter above).
  const headcount = await prisma.employee.count({ where: activeFilter });
  const active = await prisma.employee.count({ where: { ...activeFilter, status: "ACTIVE" } });
  const onLeave = await prisma.employee.count({ where: { ...activeFilter, status: "ON_LEAVE" } });
  const newThisMonth = await prisma.employee.count({ where: { ...activeFilter, hireDate: { gte: startOfMonth } } });
  const presentToday = await prisma.attendanceRecord.count({
    where: { companyId, deletedAt: null, workDate: { gte: todayStart, lt: todayEnd }, clockInAt: { not: null }, ...employeeIdFilter },
  });
  const lateToday = await prisma.attendanceRecord.count({
    where: { companyId, deletedAt: null, workDate: { gte: todayStart, lt: todayEnd }, status: "LATE", ...employeeIdFilter },
  });
  const onLeaveTodayRows = await prisma.leaveRequest.findMany({
    where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: todayEnd }, endDate: { gte: todayStart }, ...employeeIdFilter },
    select: { employeeId: true },
  });
  const otTodayAgg = await prisma.overtimeRequest.aggregate({
    _sum: { hours: true },
    where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: todayStart, lt: todayEnd }, ...employeeIdFilter },
  });
  const byDeptRaw = await prisma.employee.groupBy({
    by: ["departmentId"],
    where: activeFilter,
    _count: { _all: true },
  });
  const byStatusRaw = await prisma.employee.groupBy({
    by: ["status"],
    where: activeFilter,
    _count: { _all: true },
  });
  const byTypeRaw = await prisma.employee.groupBy({
    by: ["employmentType"],
    where: activeFilter,
    _count: { _all: true },
  });
  const depts = await prisma.department.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true },
  });

  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const onLeaveToday = new Set(onLeaveTodayRows.map((r) => r.employeeId)).size;
  const otHoursToday = Math.round((otTodayAgg._sum.hours ?? 0) * 10) / 10;
  const attendanceRate = active > 0 ? Math.round((presentToday / active) * 1000) / 10 : 0;

  return {
    headcount,
    active,
    onLeave,
    newThisMonth,
    presentToday,
    lateToday,
    onLeaveToday,
    otHoursToday,
    attendanceRate,
    byDepartment: byDeptRaw
      .map((r) => ({
        name: r.departmentId ? (deptName.get(r.departmentId) ?? "ไม่ระบุ") : "ไม่ระบุ",
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    byStatus: byStatusRaw.map((r) => ({ status: r.status, count: r._count._all })),
    byEmploymentType: byTypeRaw.map((r) => ({ type: r.employmentType, count: r._count._all })),
  };
}

export interface AttendanceTrendPoint {
  date: string; // "YYYY-MM-DD"
  label: string; // "26 ส.ค."
  present: number;
  late: number;
  absent: number;
  leave: number;
  otHours: number;
}

const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Day-by-day attendance/leave/OT trend for the last `days` business days —
 * "absent" isn't a status anything ever writes (same as the report/payroll
 * absence logic elsewhere): a business day this employee has no clock-in and
 * no approved leave, and it isn't a holiday. `active` is snapshotted once
 * (today's headcount) rather than reconstructed historically — a reasonable
 * approximation for a trend chart, not a payroll-grade figure.
 */
export async function getAttendanceTrend(companyId: string, days = 14): Promise<AttendanceTrendPoint[]> {
  const DAY_MS = 86_400_000;
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * DAY_MS);

  // Sequential, not Promise.all — connection_limit=1 (see getActionCenter above).
  const activeCount = await prisma.employee.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } });
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, workDate: { gte: start, lt: end } },
    select: { workDate: true, status: true, clockInAt: true, employeeId: true },
  });
  const holidays = await prisma.holiday.findMany({ where: { companyId, deletedAt: null, date: { gte: start, lt: end } }, select: { date: true } });
  const leaves = await prisma.leaveRequest.findMany({
    where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true, employeeId: true },
  });
  const otRows = await prisma.overtimeRequest.groupBy({
    by: ["date"],
    where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: start, lt: end } },
    _sum: { hours: true },
  });

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const holidaySet = new Set(holidays.map((h) => iso(h.date)));
  const otByDate = new Map(otRows.map((r) => [iso(r.date), r._sum.hours ?? 0]));

  const recordsByDate = new Map<string, typeof records>();
  for (const r of records) {
    const key = iso(r.workDate);
    const list = recordsByDate.get(key) ?? [];
    list.push(r);
    recordsByDate.set(key, list);
  }

  const points: AttendanceTrendPoint[] = [];
  for (let d = new Date(start); d.getTime() < end.getTime(); d = new Date(d.getTime() + DAY_MS)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // weekend
    const key = iso(d);
    if (holidaySet.has(key)) continue;

    const dayRecords = recordsByDate.get(key) ?? [];
    const present = dayRecords.filter((r) => r.clockInAt).length;
    const late = dayRecords.filter((r) => r.status === "LATE").length;
    const onLeaveEmployeeIds = new Set(
      leaves.filter((l) => l.startDate.getTime() <= d.getTime() && l.endDate.getTime() >= d.getTime()).map((l) => l.employeeId),
    );
    const absent = Math.max(0, activeCount - present - onLeaveEmployeeIds.size);

    points.push({
      date: key,
      label: `${d.getUTCDate()} ${THAI_MONTH_SHORT[d.getUTCMonth()]}`,
      present,
      late,
      absent,
      leave: onLeaveEmployeeIds.size,
      otHours: Math.round((otByDate.get(key) ?? 0) * 10) / 10,
    });
  }

  return points;
}

export interface DepartmentWatchRow {
  name: string;
  count: number;
}

/**
 * "Which departments need attention" — late + absent occurrences per
 * department over the last `days` days, descending. Reuses the same absence
 * derivation as `getAttendanceTrend` but bucketed by department instead of
 * by day, so HR gets a ranked list to focus on instead of just a companywide
 * trend line.
 */
export async function getDepartmentWatchlist(companyId: string, days = 30): Promise<DepartmentWatchRow[]> {
  const DAY_MS = 86_400_000;
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * DAY_MS);

  // Sequential, not Promise.all — connection_limit=1 (see getActionCenter above).
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, departmentId: true, department: { select: { name: true } } },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { companyId, deletedAt: null, workDate: { gte: start, lt: end } },
    select: { workDate: true, status: true, clockInAt: true, employeeId: true },
  });
  const holidays = await prisma.holiday.findMany({ where: { companyId, deletedAt: null, date: { gte: start, lt: end } }, select: { date: true } });
  const leaves = await prisma.leaveRequest.findMany({
    where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true, employeeId: true },
  });

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const holidaySet = new Set(holidays.map((h) => iso(h.date)));
  const deptById = new Map(employees.map((e) => [e.id, e.department?.name ?? "ไม่ระบุแผนก"]));

  const recordsByEmployeeDay = new Map<string, { status: string; clockInAt: Date | null }>();
  for (const r of records) {
    recordsByEmployeeDay.set(`${r.employeeId}|${iso(r.workDate)}`, r);
  }
  const leavesByEmployee = new Map<string, { startDate: Date; endDate: Date }[]>();
  for (const l of leaves) {
    const list = leavesByEmployee.get(l.employeeId) ?? [];
    list.push(l);
    leavesByEmployee.set(l.employeeId, list);
  }

  const scoreByDept = new Map<string, number>();
  for (const emp of employees) {
    const deptName = deptById.get(emp.id) ?? "ไม่ระบุแผนก";
    const myLeaves = leavesByEmployee.get(emp.id) ?? [];
    for (let d = new Date(start); d.getTime() < end.getTime(); d = new Date(d.getTime() + DAY_MS)) {
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const key = iso(d);
      if (holidaySet.has(key)) continue;
      const onLeave = myLeaves.some((l) => l.startDate.getTime() <= d.getTime() && l.endDate.getTime() >= d.getTime());
      if (onLeave) continue;
      const rec = recordsByEmployeeDay.get(`${emp.id}|${key}`);
      if (!rec?.clockInAt) {
        scoreByDept.set(deptName, (scoreByDept.get(deptName) ?? 0) + 1); // absent
      } else if (rec.status === "LATE") {
        scoreByDept.set(deptName, (scoreByDept.get(deptName) ?? 0) + 1); // late
      }
    }
  }

  return [...scoreByDept.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
