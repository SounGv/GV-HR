import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import { isCompanyWideEmployeeViewer } from "@/features/employee/service";
import type { AccessClaims } from "@/lib/auth/jwt";

export type AiScope = "TEAM" | "DEPARTMENT" | "COMPANY";

export interface AiAccess {
  allowed: boolean;
  scope: AiScope;
}

/**
 * Resolves whether the AI Assistant is reachable at all, and at what data
 * scope, for this request. Combines role-based `ai:read` (existing RBAC,
 * unchanged) with a fresh per-request `AiAccessGrant` lookup — never cached
 * in the JWT, so an HR revoke takes effect on the very next request instead
 * of waiting out the access token's lifetime.
 *
 * Company-wide-by-role users (Super Admin, HR Manager, Finance — same rule
 * `isCompanyWideEmployeeViewer` already uses for the employee directory)
 * always get COMPANY scope regardless of any grant row, so a grant can only
 * ever *add* AI reach or narrow/widen scope for people who aren't already
 * unrestricted by role.
 */
export async function resolveAiAccess(session: AccessClaims): Promise<AiAccess> {
  const roleAllowsAi = can(session.perms, "ai:read");

  if (isCompanyWideEmployeeViewer(session)) {
    return { allowed: roleAllowsAi, scope: "COMPANY" };
  }

  const grant = session.employeeId
    ? await prisma.aiAccessGrant.findUnique({
        where: { employeeId: session.employeeId },
        select: { scope: true },
      })
    : null;

  if (!roleAllowsAi && !grant) return { allowed: false, scope: "TEAM" };

  // Role gives ai:read with no grant on file → default to TEAM (closes a
  // pre-existing gap where a plain Manager got unscoped company-wide tool
  // answers). A grant, if present, always wins over that default.
  return { allowed: true, scope: grant?.scope ?? "TEAM" };
}

/** Employee-table filter matching a resolved scope. undefined = no filter (COMPANY). */
export async function employeeScopeWhere(
  session: AccessClaims,
  scope: AiScope,
): Promise<Prisma.EmployeeWhereInput | undefined> {
  if (scope === "COMPANY") return undefined;

  const employeeId = session.employeeId;
  if (!employeeId) return { id: "__none__" }; // no linked employee row → sees nothing scoped

  if (scope === "TEAM") return { OR: [{ id: employeeId }, { managerId: employeeId }] };

  // DEPARTMENT
  const me = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
  if (!me?.departmentId) return { id: employeeId }; // no department on file → fall back to self-only
  return { departmentId: me.departmentId };
}
