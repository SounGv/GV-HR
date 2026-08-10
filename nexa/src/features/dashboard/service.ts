import { prisma } from "@/lib/prisma";
import type { RequestStep } from "@/features/workflow/types";
import { getRemainingBalance } from "@/features/leave/service";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";

/** The three paid leave types that actually deduct an annual quota (see `deductsBalance`) — UNPAID/OTHER have no meaningful "remaining" to show. */
const LEAVE_TYPES_FOR_SUMMARY = ["ANNUAL", "SICK", "PERSONAL"] as const;

export interface DashboardActions {
  approvals: { leave: number; overtime: number; expense: number; workflow: number };
  myPending: number;
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

  const [
    leave,
    overtime,
    expense,
    pendingRequests,
    myLeave,
    myOvertime,
    myExpense,
    myWorkflow,
    shift,
  ] = await Promise.all([
    hasReports
      ? prisma.leaveRequest.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
      : Promise.resolve(0),
    hasReports
      ? prisma.overtimeRequest.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
      : Promise.resolve(0),
    hasReports
      ? prisma.expenseClaim.count({ where: { ...reportFilter, employeeId: { in: reportIds } } })
      : Promise.resolve(0),
    prisma.approvalRequest.findMany({
      where: { companyId, status: "PENDING" },
      select: { steps: true, currentStep: true, requesterEmployeeId: true },
      take: 300,
    }),
    employeeId
      ? prisma.leaveRequest.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
      : Promise.resolve(0),
    employeeId
      ? prisma.overtimeRequest.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
      : Promise.resolve(0),
    employeeId
      ? prisma.expenseClaim.count({ where: { companyId, deletedAt: null, status: "PENDING", employeeId } })
      : Promise.resolve(0),
    employeeId
      ? prisma.approvalRequest.count({
          where: { companyId, status: "PENDING", requesterEmployeeId: employeeId },
        })
      : Promise.resolve(0),
    employeeId
      ? prisma.shiftAssignment.findUnique({
          where: { employeeId_date: { employeeId, date: todayUtc } },
          select: { template: { select: { name: true, startTime: true, endTime: true } } },
        })
      : Promise.resolve(null),
  ]);

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
    shiftToday: shift?.template ?? null,
  };
}

export interface LeaveBalanceSummary {
  type: string;
  label: string;
  remaining: number;
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

  const [today, leaveBalances, latestPayslip, recognitionRows] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { companyId, employeeId, workDate: todayStart, deletedAt: null },
      select: { clockInAt: true, clockOutAt: true },
    }),
    Promise.all(
      LEAVE_TYPES_FOR_SUMMARY.map(async (type) => ({
        type,
        label: LEAVE_TYPE_LABEL[type],
        remaining: await getRemainingBalance(companyId, employeeId, type, year),
      })),
    ),
    prisma.payrollRecord.findFirst({
      where: { companyId, employeeId },
      orderBy: { period: "desc" },
      select: { periodLabel: true, net: true },
    }),
    prisma.recognition.groupBy({
      by: ["type"],
      where: { companyId, employeeId, deletedAt: null },
      _count: { _all: true },
      _sum: { points: true },
    }),
  ]);

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

/** Real, company-scoped headcount analytics derived from the Employee table. */
export async function getDashboardSummary(companyId: string): Promise<DashboardSummary> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const activeFilter = { companyId, deletedAt: null };

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const [
    headcount,
    active,
    onLeave,
    newThisMonth,
    presentToday,
    lateToday,
    onLeaveTodayRows,
    otTodayAgg,
    byDeptRaw,
    byStatusRaw,
    byTypeRaw,
    depts,
  ] = await Promise.all([
      prisma.employee.count({ where: activeFilter }),
      prisma.employee.count({ where: { ...activeFilter, status: "ACTIVE" } }),
      prisma.employee.count({ where: { ...activeFilter, status: "ON_LEAVE" } }),
      prisma.employee.count({ where: { ...activeFilter, hireDate: { gte: startOfMonth } } }),
      prisma.attendanceRecord.count({
        where: { companyId, deletedAt: null, workDate: { gte: todayStart, lt: todayEnd }, clockInAt: { not: null } },
      }),
      prisma.attendanceRecord.count({
        where: { companyId, deletedAt: null, workDate: { gte: todayStart, lt: todayEnd }, status: "LATE" },
      }),
      prisma.leaveRequest.findMany({
        where: { companyId, deletedAt: null, status: "APPROVED", startDate: { lt: todayEnd }, endDate: { gte: todayStart } },
        select: { employeeId: true },
      }),
      prisma.overtimeRequest.aggregate({
        _sum: { hours: true },
        where: { companyId, deletedAt: null, status: "APPROVED", date: { gte: todayStart, lt: todayEnd } },
      }),
      prisma.employee.groupBy({
        by: ["departmentId"],
        where: activeFilter,
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["status"],
        where: activeFilter,
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["employmentType"],
        where: activeFilter,
        _count: { _all: true },
      }),
      prisma.department.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

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
