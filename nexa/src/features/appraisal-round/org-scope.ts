import type { Prisma } from "@prisma/client";

/**
 * Everyone below one person in the org chart (only a type import, so it runs under
 * `node --experimental-strip-types scripts/check-appraisal-org-scope.mjs`).
 *
 * Managers may follow and read appraisal results only for the people under
 * them: their direct reports and everyone below those (owner's decision,
 * 2026-11-13), plus the people they themselves rate as manager in a round
 * (owner's decision, 2026-11-17: some managers rate people the org chart does not
 * put under them, and saw nothing). The person themself is never included, so a
 * manager reads their own result only through "ผลประเมินของฉัน", which hides who
 * wrote what.
 */

export interface ManagerLink {
  id: string;
  managerId: string | null;
}

/**
 * Ids of everyone who reports to `rootId`, directly or through others.
 *
 * @param people Every live employee with their manager.
 * @param rootId The person whose team this is.
 * @returns The ids under `rootId`; never contains `rootId`, safe against manager loops.
 */
export function idsUnder(people: readonly ManagerLink[], rootId: string): Set<string> {
  const reports = new Map<string, string[]>();
  for (const p of people) {
    if (!p.managerId) continue;
    const list = reports.get(p.managerId) ?? [];
    list.push(p.id);
    reports.set(p.managerId, list);
  }
  const found = new Set<string>();
  const queue = [...(reports.get(rootId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === rootId || found.has(id)) continue;
    found.add(id);
    queue.push(...(reports.get(id) ?? []));
  }
  return found;
}

/**
 * A participant filter for what a viewer may see: no filter for HR (`ids` null), otherwise the people in `ids`
 * (the org-chart team) and, in that same round, the people the viewer rates as their manager.
 *
 * @param ids The viewer's org-chart team, or null for HR.
 * @param viewerEmployeeId The viewer's own employee id; without it only the org-chart team counts.
 * @returns A filter to spread into an `appraisalParticipant` where clause. It carries an `OR` key for managers, so a caller must not set its own `OR` beside it.
 */
export function participantScope(ids: Set<string> | null, viewerEmployeeId?: string | null): Prisma.AppraisalParticipantWhereInput {
  if (!ids) return {};
  const team: Prisma.AppraisalParticipantWhereInput = { employeeId: { in: [...ids] } };
  if (!viewerEmployeeId) return team;
  // The rater clause is per participant, so it only reaches the rounds where this person really is the rater.
  const rated: Prisma.AppraisalParticipantWhereInput = {
    employeeId: { not: viewerEmployeeId },
    assignments: { some: { raterEmployeeId: viewerEmployeeId, raterType: "MANAGER" } },
  };
  return { OR: [team, rated] };
}
