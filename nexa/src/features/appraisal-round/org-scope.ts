/**
 * Everyone below one person in the org chart (no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-org-scope.mjs`).
 *
 * Managers may follow and read appraisal results only for the people under
 * them: their direct reports and everyone below those (owner's decision,
 * 2026-11-13). The person themself is never included, so a manager reads their
 * own result only through "ผลประเมินของฉัน", which hides who wrote what.
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
