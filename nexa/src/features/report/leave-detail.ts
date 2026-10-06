import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { teamScopeFilter } from "@/features/employee/service";
import { LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL } from "@/features/leave/labels";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface LeaveTypeSummary {
  type: string;
  label: string;
  /** null for types that have no entitlement (unpaid, other). */
  total: number | null;
  used: number;
  left: number | null;
  /** Days waiting for approval, not yet counted in `used`. */
  pending: number;
  /**
   * Days in `used` that have no approved request behind them (usage carried over
   * from the old system, or a manual adjustment), so no date can be shown for them.
   */
  untracked: number;
}

export interface LeaveRequestLine {
  id: string;
  type: string;
  typeLabel: string;
  startIso: string;
  endIso: string;
  days: number;
  hours: number | null;
  halfDay: boolean;
  status: string;
  statusLabel: string;
}

export interface EmployeeLeaveYear {
  code: string;
  name: string;
  department: string;
  year: number;
  types: LeaveTypeSummary[];
  requests: LeaveRequestLine[];
}

const PAID = ["SICK", "PERSONAL", "ANNUAL"] as const;

/**
 * One person's leave for a year: entitlement / used / remaining / pending per
 * type, and every request (approved, pending, rejected, cancelled) with its
 * dates. Team scope applies, so a manager gets null for anyone outside their
 * team. The reason and attachment are never read.
 */
export async function loadEmployeeLeaveYear(
  companyId: string,
  session: AccessClaims,
  code: string,
  year: number,
): Promise<EmployeeLeaveYear | null> {
  const scope = teamScopeFilter(session);
  const emp = await prisma.employee.findFirst({
    where: { companyId, deletedAt: null, employeeCode: code, ...(scope ?? {}) },
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
  });
  if (!emp) return null;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  // Sequential, not Promise.all — connection_limit=1.
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId: emp.id, year },
    select: { type: true, totalDays: true, usedDays: true },
  });
  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId: emp.id, deletedAt: null, startDate: { lt: yearEnd }, endDate: { gte: yearStart } },
    select: { id: true, type: true, startDate: true, endDate: true, days: true, hours: true, unit: true, halfDay: true, status: true },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const pendingByType = new Map<string, number>();
  const approvedByType = new Map<string, number>();
  for (const r of requests) {
    const bucket = r.status === "PENDING" ? pendingByType : r.status === "APPROVED" ? approvedByType : null;
    if (bucket) bucket.set(r.type, (bucket.get(r.type) ?? 0) + r.days);
  }

  const types: LeaveTypeSummary[] = PAID.map((type) => {
    const rows = balances.filter((b) => b.type === type);
    const total = rows.reduce((s, b) => s + b.totalDays, 0);
    const used = rows.reduce((s, b) => s + b.usedDays, 0);
    return {
      type,
      label: LEAVE_TYPE_LABEL[type],
      total: r1(total),
      used: r1(used),
      left: r1(Math.max(0, total - used)),
      pending: r1(pendingByType.get(type) ?? 0),
      untracked: r1(Math.max(0, used - (approvedByType.get(type) ?? 0))),
    };
  });
  for (const type of ["UNPAID", "OTHER"] as const) {
    types.push({
      type,
      label: LEAVE_TYPE_LABEL[type],
      total: null,
      used: r1(approvedByType.get(type) ?? 0),
      left: null,
      pending: r1(pendingByType.get(type) ?? 0),
      untracked: 0,
    });
  }

  return {
    code,
    name: `${emp.firstName} ${emp.lastName}`.trim(),
    department: emp.department?.name ?? "ไม่ระบุแผนก",
    year,
    types,
    requests: requests.map((r) => ({
      id: r.id,
      type: r.type,
      typeLabel: LEAVE_TYPE_LABEL[r.type] ?? r.type,
      startIso: iso(r.startDate),
      endIso: iso(r.endDate),
      days: r1(r.days),
      hours: r.unit === "HOUR" ? r.hours : null,
      halfDay: r.halfDay,
      status: r.status,
      statusLabel: LEAVE_STATUS_LABEL[r.status] ?? r.status,
    })),
  };
}
