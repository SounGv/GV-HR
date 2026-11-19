import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api/response";
import { suggestNextEmployeeCode, teamScopeFilter } from "@/features/employee/service";

export const runtime = "nodejs";

/** Reference data for employee forms: departments, positions, branches, cost centers, managers. */
export async function GET() {
  try {
    const session = await requirePermission("employee:read");
    const companyId = session.companyId;
    const where = { companyId, deletedAt: null };

    // Sequential, not Promise.all — connection_limit=1.
    const departments = await prisma.department.findMany({ where, select: { id: true, name: true, branchId: true }, orderBy: { name: "asc" } });
    const positions = await prisma.position.findMany({
      where,
      select: { id: true, title: true, departmentId: true },
      orderBy: { title: "asc" },
    });
    const branches = await prisma.branch.findMany({ where, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const costCenters = await prisma.costCenter.findMany({ where, select: { id: true, name: true }, orderBy: { name: "asc" } });
    // A plain manager sees only themself and their team here, like the employee list; the company-wide
    // reporting line is for HR / Finance.
    const scope = teamScopeFilter(session);
    const managers = await prisma.employee.findMany({
      where: scope ? { ...where, AND: [scope] } : where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        employeeCode: true,
        managerId: true,
        departmentId: true,
        employmentType: true,
        branchId: true,
        costCenterId: true,
      },
      orderBy: { firstName: "asc" },
      take: 2000,
    });
    const nextEmployeeCode = await suggestNextEmployeeCode(companyId);

    return ok({ departments, positions, branches, costCenters, managers, nextEmployeeCode });
  } catch (err) {
    return handleApiError(err);
  }
}
