/**
 * Pure rules behind the org chart (org-division-mock.html): which departments
 * form a division (ฝ่าย), who heads it, who leads each department, and which
 * data problems make the chart wrong. No React, no Prisma, no path aliases, so
 * scripts/check-org-tree.mjs can import it with node --experimental-strip-types.
 *
 * Rules
 * - Root department: no parent, or its parent is not among the live
 *   departments (soft-deleted or missing). Departments caught in a parent loop
 *   that no root reaches are treated as roots too, so nothing disappears.
 * - Division: a root with live sub-departments, or a childless root with more
 *   than {@link OTHER_MAX_PEOPLE} people. Childless roots with
 *   ≤ {@link OTHER_MAX_PEOPLE} people go into one "ฝ่ายอื่นๆ" group.
 * - Headcount comes from the people list (one person counts in one department).
 * - Tops: members with nobody above them inside the division (their manager
 *   is in another division, or they have none).
 * - Division head: a top with people under them (directly or further down) who
 *   sits in the division's own root department; if none does and exactly one
 *   top has people under them, that person. Several heads show side by side.
 *   ฝ่ายอื่นๆ never has a head (it is not a real division).
 * - Department lead: a non-head top with people under them who sits in that
 *   department (e.g. a department head reporting to the CEO); otherwise the
 *   member with the most people of the same department under them; none when
 *   nobody in the department reports to anyone else in it.
 * - "ยังไม่ระบุหัวหน้า": members with no manager at all (none, or not an active
 *   employee) and nobody under them, who are not the head. People whose manager
 *   is in another division stay in their department column. Not used for ฝ่ายอื่นๆ.
 * - managerId loops (A → B → A) never hang: every walk keeps a visited set.
 */

export const OTHER_KEY = "__other";
export const OTHER_NAME = "ฝ่ายอื่นๆ";
/** Childless root departments with at most this many people go into ฝ่ายอื่นๆ. */
export const OTHER_MAX_PEOPLE = 2;

export interface OrgDept {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

export interface OrgPerson {
  id: string;
  /** displayName(): "first last (nickname)". */
  name: string;
  nickname: string | null;
  departmentId: string | null;
  managerId: string | null;
  positionTitle: string | null;
}

export interface DivisionDept {
  id: string;
  name: string;
  code: string;
  count: number;
  /** 1 = directly under the division root; deeper levels are indented. */
  depth: number;
}

export interface Division {
  /** Root department id, or {@link OTHER_KEY} for the ฝ่ายอื่นๆ group. */
  key: string;
  name: string;
  code: string;
  isOther: boolean;
  /** People sitting directly in the root department (0 for ฝ่ายอื่นๆ). */
  rootCount: number;
  /** Sub-departments of the root (or the grouped roots for ฝ่ายอื่นๆ). */
  departments: DivisionDept[];
  /** Every department id whose people belong to this division. */
  deptIds: string[];
  headcount: number;
}

export interface CompanyTree {
  divisions: Division[];
  total: number;
}

function liveDeptMap(depts: OrgDept[]): Map<string, OrgDept> {
  return new Map(depts.map((d) => [d.id, d]));
}

/** True when the department has no live parent (none, deleted or missing). */
export function isRootDept(d: OrgDept, live: Map<string, OrgDept>): boolean {
  return !d.parentId || d.parentId === d.id || !live.has(d.parentId);
}

function countByDept(people: OrgPerson[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of people) {
    if (p.departmentId) counts.set(p.departmentId, (counts.get(p.departmentId) ?? 0) + 1);
  }
  return counts;
}

/** Groups departments into divisions and the ฝ่ายอื่นๆ card; biggest division first, ฝ่ายอื่นๆ last. */
export function buildCompanyTree(depts: OrgDept[], people: OrgPerson[]): CompanyTree {
  const live = liveDeptMap(depts);
  const counts = countByDept(people);
  const children = new Map<string, OrgDept[]>();
  for (const d of depts) {
    if (isRootDept(d, live)) continue;
    const list = children.get(d.parentId!) ?? [];
    list.push(d);
    children.set(d.parentId!, list);
  }
  const byName = (a: OrgDept, b: OrgDept) => a.name.localeCompare(b.name, "th");

  const reached = new Set<string>();
  const roots = depts.filter((d) => isRootDept(d, live));
  const walkFrom = (root: OrgDept): DivisionDept[] => {
    const out: DivisionDept[] = [];
    reached.add(root.id);
    const visit = (id: string, depth: number) => {
      for (const c of [...(children.get(id) ?? [])].sort(byName)) {
        if (reached.has(c.id)) continue;
        reached.add(c.id);
        out.push({ id: c.id, name: c.name, code: c.code, count: counts.get(c.id) ?? 0, depth });
        visit(c.id, depth + 1);
      }
    };
    visit(root.id, 1);
    return out;
  };

  const divisions: Division[] = [];
  const others: DivisionDept[] = [];
  const addRoot = (root: OrgDept) => {
    const subs = walkFrom(root);
    const rootCount = counts.get(root.id) ?? 0;
    if (subs.length === 0 && rootCount <= OTHER_MAX_PEOPLE) {
      others.push({ id: root.id, name: root.name, code: root.code, count: rootCount, depth: 1 });
      return;
    }
    divisions.push({
      key: root.id,
      name: root.name,
      code: root.code,
      isOther: false,
      rootCount,
      departments: subs,
      deptIds: [root.id, ...subs.map((s) => s.id)],
      headcount: rootCount + subs.reduce((s, d) => s + d.count, 0),
    });
  };
  roots.forEach(addRoot);
  // Parent loops with no way in from a root: treat each unreached one as a root.
  for (const d of depts) if (!reached.has(d.id)) addRoot(d);

  divisions.sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name, "th"));
  if (others.length > 0) {
    others.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th"));
    divisions.push({
      key: OTHER_KEY,
      name: OTHER_NAME,
      code: "",
      isOther: true,
      rootCount: 0,
      departments: others,
      deptIds: others.map((d) => d.id),
      headcount: others.reduce((s, d) => s + d.count, 0),
    });
  }
  return { divisions, total: people.length };
}

/** Direct reports of each person, only counting people inside `scope`. */
function reportsWithin(scope: OrgPerson[]): Map<string, OrgPerson[]> {
  const ids = new Set(scope.map((p) => p.id));
  const map = new Map<string, OrgPerson[]>();
  for (const p of scope) {
    if (!p.managerId || p.managerId === p.id || !ids.has(p.managerId)) continue;
    const list = map.get(p.managerId) ?? [];
    list.push(p);
    map.set(p.managerId, list);
  }
  return map;
}

/** How many people sit under `id` (directly or further down); loop-safe. */
function countUnder(id: string, reports: Map<string, OrgPerson[]>): number {
  const seen = new Set<string>([id]);
  const stack = [id];
  let n = 0;
  while (stack.length > 0) {
    for (const r of reports.get(stack.pop()!) ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      n++;
      stack.push(r.id);
    }
  }
  return n;
}

export interface PersonNode {
  person: OrgPerson;
  /** People of the division under this person, directly or further down. */
  under: number;
}

export interface TeamColumn {
  deptId: string;
  name: string;
  /** People in this department, heads included. */
  count: number;
  lead: PersonNode | null;
  /** Everyone else shown in the column (lead, heads and unassigned left out). */
  members: OrgPerson[];
}

export interface DivisionPeople {
  members: OrgPerson[];
  heads: PersonNode[];
  teams: TeamColumn[];
  unassigned: OrgPerson[];
  /** Number of team columns that have a lead (the hero's หัวหน้าแผนก tile). */
  leadCount: number;
}

const byPersonName = (a: OrgPerson, b: OrgPerson) => a.name.localeCompare(b.name, "th");

/** The reporting-line view of one division: heads, one column per department, and the unassigned box. */
export function buildDivisionPeople(division: Division, people: OrgPerson[]): DivisionPeople {
  const deptSet = new Set(division.deptIds);
  const allIds = new Set(people.map((p) => p.id));
  const members = people.filter((p) => p.departmentId && deptSet.has(p.departmentId));
  const memberIds = new Set(members.map((p) => p.id));
  const reports = reportsWithin(members);
  const under = (id: string) => countUnder(id, reports);
  const hasNoManager = (p: OrgPerson) => !p.managerId || p.managerId === p.id || !allIds.has(p.managerId);

  // Tops: nobody inside the division above them. Those with people under them
  // are heads or department leads; the rest keep their column, except people
  // with no manager at all, who go to the unassigned box.
  const tops = members.filter((p) => hasNoManager(p) || !memberIds.has(p.managerId!));
  const candidates: PersonNode[] = tops
    .map((person) => ({ person, under: under(person.id) }))
    .filter((n) => n.under > 0)
    .sort((a, b) => b.under - a.under || byPersonName(a.person, b.person));

  // ฝ่ายอื่นๆ is a made-up group of unrelated small departments: no head over it.
  let heads: PersonNode[] = [];
  if (!division.isOther) {
    heads = candidates.filter((n) => n.person.departmentId === division.key);
    if (heads.length === 0 && candidates.length === 1) heads = candidates;
  }
  const headIds = new Set(heads.map((h) => h.person.id));
  const unassigned = division.isOther
    ? []
    : tops.filter((p) => !headIds.has(p.id) && hasNoManager(p) && under(p.id) === 0).sort(byPersonName);
  const unassignedIds = new Set(unassigned.map((p) => p.id));
  const leadCandidates = new Map<string, PersonNode>();
  for (const c of candidates) {
    if (!headIds.has(c.person.id) && !leadCandidates.has(c.person.departmentId!)) leadCandidates.set(c.person.departmentId!, c);
  }

  const columnOrder: { id: string; name: string }[] = division.isOther
    ? division.departments.map((d) => ({ id: d.id, name: d.name }))
    : [{ id: division.key, name: division.name }, ...division.departments.map((d) => ({ id: d.id, name: d.name }))];

  const teams: TeamColumn[] = [];
  for (const col of columnOrder) {
    const inDept = members.filter((p) => p.departmentId === col.id);
    const shown = inDept.filter((p) => !headIds.has(p.id) && !unassignedIds.has(p.id));
    if (shown.length === 0) continue;
    // A top person with a team who sits here leads it; otherwise the member
    // with the most people of this department under them.
    let lead: PersonNode | null = leadCandidates.get(col.id) ?? null;
    if (!lead) {
      const deptReports = reportsWithin(shown);
      let best = 0;
      for (const p of shown) {
        const n = countUnder(p.id, deptReports);
        if (n > best || (n === best && n > 0 && lead && byPersonName(p, lead.person) < 0)) {
          best = n;
          lead = { person: p, under: under(p.id) };
        }
      }
    }
    const rest = shown.filter((p) => p.id !== lead?.person.id);
    const directOfLead = new Set((lead ? reports.get(lead.person.id) ?? [] : []).map((p) => p.id));
    rest.sort(
      (a, b) =>
        Number(directOfLead.has(b.id)) - Number(directOfLead.has(a.id)) || under(b.id) - under(a.id) || byPersonName(a, b),
    );
    teams.push({ deptId: col.id, name: col.name, count: inDept.length, lead, members: rest });
  }

  return {
    members,
    heads,
    teams,
    unassigned,
    leadCount: teams.filter((t) => t.lead).length,
  };
}

/** The top person to show on a division card in the company view, if any. */
export function divisionHead(division: Division, people: OrgPerson[]): PersonNode | null {
  return buildDivisionPeople(division, people).heads[0] ?? null;
}

export interface OrgIssues {
  /** Departments whose parent was deleted or no longer exists. */
  orphanDepts: { id: string; name: string; count: number }[];
  /** Groups of department names that look like the same department. */
  duplicateNames: string[][];
  /** Departments that look like test data. */
  testDepts: { id: string; name: string; count: number }[];
  /** People with no department, or whose department was deleted. */
  noDepartment: number;
  /** People with no manager, or whose manager is no longer an active employee. */
  noManager: number;
  /** People caught in a managerId loop (A → B → A). */
  managerLoop: number;
}

const DEPT_PREFIX = /^(ฝ่าย|แผนก)\s*/;

/** Name used to spot duplicates: prefix kind + the rest without spaces, lower-cased. */
function nameKey(name: string): { kind: string; base: string } {
  const trimmed = name.trim();
  const kind = DEPT_PREFIX.exec(trimmed)?.[1] ?? "";
  return { kind, base: trimmed.replace(DEPT_PREFIX, "").replace(/\s+/g, "").toLowerCase() };
}

/**
 * Two names look like one department when they share the prefix (ฝ่าย / แผนก /
 * none) and either match after dropping spaces, or one is the other plus
 * "และ…" (e.g. "ฝ่ายเซอร์วิส" and "ฝ่ายเซอร์วิสและเคลม").
 */
export function looksLikeSameDept(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  if (x.kind !== y.kind || !x.base || !y.base) return false;
  if (x.base === y.base) return true;
  const [short, long] = x.base.length < y.base.length ? [x.base, y.base] : [y.base, x.base];
  return long.startsWith(short) && long.slice(short.length).startsWith("และ");
}

const TEST_NAME = /\btest\b|ทดสอบ/i;

/** Data problems that make the chart wrong, for the amber "ข้อมูลที่ควรแก้" box. */
export function detectOrgIssues(depts: OrgDept[], people: OrgPerson[]): OrgIssues {
  const live = liveDeptMap(depts);
  const counts = countByDept(people);

  const orphanDepts = depts
    .filter((d) => d.parentId && d.parentId !== d.id && !live.has(d.parentId))
    .map((d) => ({ id: d.id, name: d.name, count: counts.get(d.id) ?? 0 }));

  const duplicateNames: string[][] = [];
  const grouped = new Set<string>();
  for (let i = 0; i < depts.length; i++) {
    if (grouped.has(depts[i].id)) continue;
    const group = [depts[i]];
    for (let j = i + 1; j < depts.length; j++) {
      if (!grouped.has(depts[j].id) && looksLikeSameDept(depts[i].name, depts[j].name)) group.push(depts[j]);
    }
    if (group.length > 1) {
      group.forEach((d) => grouped.add(d.id));
      duplicateNames.push(group.map((d) => d.name));
    }
  }

  const testDepts = depts
    .filter((d) => TEST_NAME.test(d.name) || TEST_NAME.test(d.code))
    .map((d) => ({ id: d.id, name: d.name, count: counts.get(d.id) ?? 0 }));

  const personIds = new Set(people.map((p) => p.id));
  const byId = new Map(people.map((p) => [p.id, p]));
  let managerLoop = 0;
  for (const p of people) {
    const seen = new Set<string>();
    let cur: OrgPerson | undefined = p;
    while (cur?.managerId && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.managerId);
      if (cur?.id === p.id) {
        managerLoop++;
        break;
      }
    }
  }

  return {
    orphanDepts,
    duplicateNames,
    testDepts,
    noDepartment: people.filter((p) => !p.departmentId || !live.has(p.departmentId)).length,
    noManager: people.filter((p) => !p.managerId || p.managerId === p.id || !personIds.has(p.managerId)).length,
    managerLoop,
  };
}

/** True when there is anything to show in the amber box. */
export function hasOrgIssues(i: OrgIssues): boolean {
  return (
    i.orphanDepts.length > 0 ||
    i.duplicateNames.length > 0 ||
    i.testDepts.length > 0 ||
    i.noDepartment > 0 ||
    i.noManager > 0 ||
    i.managerLoop > 0
  );
}
