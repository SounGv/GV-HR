import { prisma } from "@/lib/prisma";

export interface DashboardSummary {
  headcount: number;
  active: number;
  onLeave: number;
  newThisMonth: number;
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

  const [headcount, active, onLeave, newThisMonth, byDeptRaw, byStatusRaw, byTypeRaw, depts] =
    await Promise.all([
      prisma.employee.count({ where: activeFilter }),
      prisma.employee.count({ where: { ...activeFilter, status: "ACTIVE" } }),
      prisma.employee.count({ where: { ...activeFilter, status: "ON_LEAVE" } }),
      prisma.employee.count({ where: { ...activeFilter, hireDate: { gte: startOfMonth } } }),
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

  return {
    headcount,
    active,
    onLeave,
    newThisMonth,
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
