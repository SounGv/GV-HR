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
 * - Editing (org-edit-mock.html): {@link planOrgDrop} turns a drop into new
 *   department + manager placements, {@link checkOrgMoves} rejects a person as
 *   their own manager or a new manager loop (the API runs the same check).
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
  /** MALE / FEMALE / OTHER / null — only for the avatar; the tree rules never read it. */
  gender?: string | null;
  /** Short address of the photo; null or missing = none. */
  avatarUrl?: string | null;
  /** Paid by the day (รายวัน): listed in the team card's own box. */
  daily?: boolean;
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

/** The division's department columns in display order: the root first (not for ฝ่ายอื่นๆ), then its sub-departments. */
export function divisionColumns(division: Division): { id: string; name: string }[] {
  const subs = division.departments.map((d) => ({ id: d.id, name: d.name }));
  return division.isOther ? subs : [{ id: division.key, name: division.name }, ...subs];
}

/**
 * The reporting-line view of one division: heads, one column per department, and the unassigned box.
 * `includeEmpty` keeps columns with nobody to show (the chart's edit mode needs every column as a drop target).
 */
export function buildDivisionPeople(
  division: Division,
  people: OrgPerson[],
  opts: { includeEmpty?: boolean } = {},
): DivisionPeople {
  const deptSet = new Set(division.deptIds);
  const allIds = new Set(people.map((p) => p.id));
  const members = people.filter((p) => p.departmentId && deptSet.has(p.departmentId));
  const memberIds = new Set(members.map((p) => p.id));
  const reports = reportsWithin(members);
  const under = (id: string) => countUnder(id, reports);
  const hasNoManager = (p: OrgPerson) =>
    !p.managerId || p.managerId === p.id || !allIds.has(p.managerId);

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
    : tops
        .filter((p) => !headIds.has(p.id) && hasNoManager(p) && under(p.id) === 0)
        .sort(byPersonName);
  const unassignedIds = new Set(unassigned.map((p) => p.id));
  const leadCandidates = new Map<string, PersonNode>();
  for (const c of candidates) {
    if (!headIds.has(c.person.id) && !leadCandidates.has(c.person.departmentId!))
      leadCandidates.set(c.person.departmentId!, c);
  }

  const teams: TeamColumn[] = [];
  for (const col of divisionColumns(division)) {
    const inDept = members.filter((p) => p.departmentId === col.id);
    const shown = inDept.filter((p) => !headIds.has(p.id) && !unassignedIds.has(p.id));
    if (shown.length === 0 && !opts.includeEmpty) continue;
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
    const directOfLead = new Set(
      (lead ? (reports.get(lead.person.id) ?? []) : []).map((p) => p.id),
    );
    rest.sort(
      (a, b) =>
        Number(directOfLead.has(b.id)) - Number(directOfLead.has(a.id)) ||
        under(b.id) - under(a.id) ||
        byPersonName(a, b),
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

// ─────────── Reporting tree (org-tree-mock.html) ───────────

/** Position titles starting with this mark a team's assistant head (ผู้ช่วยหัวหน้า). */
export const ASSISTANT_PREFIX = "ผู้ช่วยหัวหน้า";

export const isAssistant = (p: OrgPerson): boolean =>
  (p.positionTitle ?? "").trim().startsWith(ASSISTANT_PREFIX);

export interface TreeTeam {
  /** Department id; null for people with no department. */
  deptId: string | null;
  name: string;
  code: string;
  /** Assistant heads, by name. */
  assistants: OrgPerson[];
  /** Everyone else except daily-paid people, by name. */
  members: OrgPerson[];
  /** Daily-paid people (รายวัน), by name. */
  daily: OrgPerson[];
  count: number;
}

export interface TreeLead {
  person: OrgPerson;
  /** People of the division under this person, directly or further down. */
  under: number;
  teams: TreeTeam[];
}

export interface DivisionTree {
  /** Division head(s), as in {@link buildDivisionPeople}. */
  heads: PersonNode[];
  /** Team heads: people with a team under them who report to the head (or to nobody in the division). */
  leads: TreeLead[];
  /** Everyone not under a team head (reports straight to the head, or to someone in another division). */
  direct: TreeTeam[];
  unassigned: OrgPerson[];
  members: OrgPerson[];
  teamCount: number;
  dailyCount: number;
}

/**
 * The division as a reporting tree: head → team heads → teams (one card per
 * department), the way the warehouse draws it on paper.
 *
 * - Team head: a member who is not the head, has people under them, and
 *   reports to the head or to nobody inside the division. Everyone under a
 *   team head, however deep, lands in that head's team cards, grouped by
 *   department (a deeper head shows as a member, tagged when an assistant).
 * - Assistant: position title starting with {@link ASSISTANT_PREFIX}; listed
 *   first in the team and tagged.
 * - Daily-paid people (`daily`) go to the team card's รายวัน box.
 * - Everyone else not under a team head is grouped by department under the head.
 * - People with no manager at all stay in "ยังไม่ระบุหัวหน้า" as before.
 */
export function buildDivisionTree(division: Division, people: OrgPerson[]): DivisionTree {
  const base = buildDivisionPeople(division, people);
  const members = base.members;
  const memberIds = new Set(members.map((p) => p.id));
  const reports = reportsWithin(members);
  const under = (id: string) => countUnder(id, reports);
  const headIds = new Set(base.heads.map((h) => h.person.id));
  const unassignedIds = new Set(base.unassigned.map((p) => p.id));

  const deptInfo = new Map<string, { name: string; code: string; order: number }>();
  divisionColumns(division).forEach((c, i) => {
    const sub = division.departments.find((x) => x.id === c.id);
    deptInfo.set(c.id, {
      name: c.name,
      code: sub?.code ?? (c.id === division.key ? division.code : ""),
      order: i,
    });
  });

  const toTeams = (list: OrgPerson[]): TreeTeam[] => {
    const groups = new Map<string, OrgPerson[]>();
    for (const p of list) {
      const k = p.departmentId ?? "";
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups]
      .map(([k, ps]) => {
        const info = deptInfo.get(k);
        const rest = ps.filter((p) => !isAssistant(p));
        const team: TreeTeam = {
          deptId: k || null,
          name: info?.name ?? "ไม่ระบุแผนก",
          code: info?.code ?? "",
          assistants: ps.filter(isAssistant).sort(byPersonName),
          members: rest.filter((p) => !p.daily).sort(byPersonName),
          daily: rest.filter((p) => p.daily).sort(byPersonName),
          count: ps.length,
        };
        return { team, order: info?.order ?? Number.MAX_SAFE_INTEGER };
      })
      .sort((a, b) => a.order - b.order || a.team.name.localeCompare(b.team.name, "th"))
      .map((x) => x.team);
  };

  const reportsToHeadOrNobody = (p: OrgPerson) =>
    !p.managerId || !memberIds.has(p.managerId) || headIds.has(p.managerId);
  const leadPeople = members
    .filter(
      (p) =>
        !headIds.has(p.id) &&
        !unassignedIds.has(p.id) &&
        under(p.id) > 0 &&
        reportsToHeadOrNobody(p),
    )
    .sort((a, b) => under(b.id) - under(a.id) || byPersonName(a, b));

  const placed = new Set<string>([...headIds, ...unassignedIds, ...leadPeople.map((p) => p.id)]);
  const leads: TreeLead[] = leadPeople.map((person) => {
    const below: OrgPerson[] = [];
    const stack = [person.id];
    while (stack.length > 0) {
      for (const r of reports.get(stack.pop()!) ?? []) {
        if (placed.has(r.id)) continue;
        placed.add(r.id);
        below.push(r);
        stack.push(r.id);
      }
    }
    return { person, under: under(person.id), teams: toTeams(below) };
  });
  const direct = toTeams(members.filter((p) => !placed.has(p.id)));
  const allTeams = [...leads.flatMap((l) => l.teams), ...direct];
  return {
    heads: base.heads,
    leads,
    direct,
    unassigned: base.unassigned,
    members,
    teamCount: allTeams.length,
    dailyCount: allTeams.reduce((n, t) => n + t.daily.length, 0),
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
      if (!grouped.has(depts[j].id) && looksLikeSameDept(depts[i].name, depts[j].name))
        group.push(depts[j]);
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
    noManager: people.filter(
      (p) => !p.managerId || p.managerId === p.id || !personIds.has(p.managerId),
    ).length,
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

// ─────────── Editing the chart (HR moves people between columns) ───────────

/** Where one person sits: department and direct manager (what approvals follow). */
export interface OrgPlacement {
  departmentId: string | null;
  managerId: string | null;
}

/** One person's new placement, as sent to POST /api/org/moves. */
export interface OrgMove extends OrgPlacement {
  employeeId: string;
}

type Placed = { id: string } & OrgPlacement;

/** People with each move applied (moves for unknown ids are ignored; later moves win). */
export function applyOrgMoves<T extends Placed>(people: T[], moves: readonly OrgMove[]): T[] {
  if (moves.length === 0) return people;
  const byId = new Map(moves.map((m) => [m.employeeId, m]));
  return people.map((p) => {
    const m = byId.get(p.id);
    return m ? { ...p, departmentId: m.departmentId, managerId: m.managerId } : p;
  });
}

/**
 * The first manager loop that passes through one of `startIds`, as the ids
 * along it (start first), or null. Loops elsewhere (old data the moves did not
 * touch) are ignored; every walk keeps a visited set so it always ends.
 */
export function findManagerCycle(people: Placed[], startIds: Iterable<string>): string[] | null {
  const managerOf = new Map(people.map((p) => [p.id, p.managerId]));
  for (const start of startIds) {
    const path = [start];
    const seen = new Set(path);
    let cur = managerOf.get(start) ?? null;
    while (cur) {
      if (cur === start) return path;
      if (seen.has(cur)) break;
      seen.add(cur);
      path.push(cur);
      cur = managerOf.get(cur) ?? null;
    }
  }
  return null;
}

export type OrgMoveProblem =
  | { kind: "duplicate"; employeeId: string }
  | { kind: "self"; employeeId: string }
  | { kind: "cycle"; ids: string[] };

/**
 * What would go wrong if `moves` were saved on top of `people`: the same person
 * twice, someone as their own manager, or a manager loop. Only people whose
 * manager actually changes are walked, so an old loop elsewhere never blocks a
 * plain department move.
 */
export function checkOrgMoves(people: Placed[], moves: readonly OrgMove[]): OrgMoveProblem | null {
  const ids = new Set<string>();
  for (const m of moves) {
    if (ids.has(m.employeeId)) return { kind: "duplicate", employeeId: m.employeeId };
    ids.add(m.employeeId);
    if (m.managerId === m.employeeId) return { kind: "self", employeeId: m.employeeId };
  }
  const managerBefore = new Map(people.map((p) => [p.id, p.managerId]));
  const changed = moves
    .filter((m) => managerBefore.get(m.employeeId) !== m.managerId)
    .map((m) => m.employeeId);
  const cycle = findManagerCycle(applyOrgMoves(people, moves), changed);
  return cycle ? { kind: "cycle", ids: cycle } : null;
}

/** A drop target in a division's edit mode: a column's lead slot or its members zone. */
export interface OrgDropTarget {
  deptId: string;
  slot: "lead" | "member";
}

/**
 * The placements a drop (or the "ย้ายไป…" select) causes, given the chart as it
 * looks now (`people` already has earlier pending moves applied). Only people
 * whose placement changes are returned.
 *
 * - Member zone: the person joins the column's department and reports to the
 *   column's lead; with no lead (or when the lead is the person), to the
 *   division head; if that is the person too, their manager stays.
 * - Lead slot: the person joins the department and reports to the division head
 *   (unchanged when there is none or it is the person). Everyone else in that
 *   column who reported to the old lead, or has no manager inside the division,
 *   now reports to the person. Division heads and the person's own managers
 *   (chain above them) are never re-pointed, so no loop comes from this rule.
 *   The old lead keeps their own manager (HR can drop them on the members zone).
 */
export function planOrgDrop(
  division: Division,
  people: OrgPerson[],
  personId: string,
  target: OrgDropTarget,
): OrgMove[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const person = byId.get(personId);
  if (!person) return [];
  const view = buildDivisionPeople(division, people, { includeEmpty: true });
  const headId = view.heads[0]?.person.id ?? null;
  const leadId = view.teams.find((t) => t.deptId === target.deptId)?.lead?.person.id ?? null;

  const next = new Map<string, OrgPlacement>();
  if (target.slot === "member") {
    let managerId = person.managerId;
    if (leadId && leadId !== personId) managerId = leadId;
    else if (headId && headId !== personId) managerId = headId;
    next.set(personId, { departmentId: target.deptId, managerId });
  } else {
    const managerId = headId && headId !== personId ? headId : person.managerId;
    next.set(personId, { departmentId: target.deptId, managerId });

    // The person's own chain after the change: those must not report to them.
    const moved = applyOrgMoves(people, [
      { employeeId: personId, departmentId: target.deptId, managerId },
    ]);
    const managerOf = new Map(moved.map((p) => [p.id, p.managerId]));
    const above = new Set<string>();
    for (
      let cur = managerOf.get(personId) ?? null;
      cur && cur !== personId && !above.has(cur);
      cur = managerOf.get(cur) ?? null
    ) {
      above.add(cur);
    }

    const memberIds = new Set(view.members.map((p) => p.id));
    const headIds = new Set(view.heads.map((h) => h.person.id));
    for (const x of view.members) {
      if (
        x.id === personId ||
        x.departmentId !== target.deptId ||
        headIds.has(x.id) ||
        above.has(x.id)
      )
        continue;
      const reportedToOldLead = leadId !== null && leadId !== personId && x.managerId === leadId;
      const noManagerInside = !x.managerId || x.managerId === x.id || !memberIds.has(x.managerId);
      if (reportedToOldLead || noManagerInside)
        next.set(x.id, { departmentId: x.departmentId, managerId: personId });
    }
  }

  const out: OrgMove[] = [];
  for (const [employeeId, p] of next) {
    const cur = byId.get(employeeId);
    if (cur && cur.departmentId === p.departmentId && cur.managerId === p.managerId) continue;
    out.push({ employeeId, ...p });
  }
  return out;
}
