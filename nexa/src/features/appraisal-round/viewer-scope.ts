import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { idsUnder } from "./org-scope";

export { participantScope } from "./org-scope";

/**
 * The employees whose appraisal tracking and results the caller may see.
 *
 * HR, who run rounds (`campaign:update`), see everyone: `null`. Anyone else
 * holding `campaign:manage` (the Manager preset) sees only the people under
 * them in the org chart, never themself. People they rate as manager are added
 * per round by `participantScope`, not here, so they stay limited to that round.
 */
export async function viewableEmployeeIds(companyId: string, session: AccessClaims): Promise<Set<string> | null> {
  if (can(session.perms, "campaign:update")) return null;
  if (!session.employeeId) return new Set();
  const people = await prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  return idsUnder(people, session.employeeId);
}

