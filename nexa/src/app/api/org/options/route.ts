import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api/response";
import { suggestNextEmployeeCode } from "@/features/employee/service";

export const runtime = "nodejs";

/** Reference data for employee forms: departments, positions, branches, managers. */
export async function GET() {
  try {
    const session = await requirePermission("employee:read");
    const companyId = session.companyId;
    const where = { companyId, deletedAt: null };

    const [departments, positions, branches, managers, nextEmployeeCode] = await Promise.all([
      prisma.department.findMany({ where, select: { id: true, name: true, branchId: true }, orderBy: { name: "asc" } }),
      prisma.position.findMany({
        where,
        select: { id: true, title: true, departmentId: true },
        orderBy: { title: "asc" },
      }),
      prisma.branch.findMany({ where, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          managerId: true,
          departmentId: true,
          employmentType: true,
          branchId: true,
          costCenterId: true,
        },
        orderBy: { firstName: "asc" },
        take: 500,
      }),
      suggestNextEmployeeCode(companyId),
    ]);

    return ok({ departments, positions, branches, managers, nextEmployeeCode });
  } catch (err) {
    return handleApiError(err);
  }
}
