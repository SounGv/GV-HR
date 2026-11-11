import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { displayName } from "@/lib/format";
import { teamScopeFilter } from "@/features/employee/service";
import { checkOrgMoves } from "./org-tree";
import type { DepartmentRow, OrgPersonRow, PositionRow } from "./types";
import type {
  DepartmentCreateInput,
  DepartmentUpdateInput,
  OrgMovesInput,
  PositionCreateInput,
  PositionUpdateInput,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

// ─────────── Departments ───────────

export async function listDepartments(companyId: string): Promise<DepartmentRow[]> {
  const rows = await prisma.department.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      parentId: true,
      _count: { select: { employees: { where: { deletedAt: null } } } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    parentId: d.parentId,
    employeeCount: d._count.employees,
  }));
}

/**
 * Active employees for the org chart's people view: who sits in which
 * department and who reports to whom. Read-only; one query.
 *
 * "Active" follows the roster convention (ACTIVE or ON_LEAVE, not deleted), so
 * leavers kept on file don't show up as someone's team member.
 *
 * Visibility follows the employee directory (`teamScopeFilter`): HR / admin /
 * Finance see the whole company; everyone else sees themself and their direct
 * reports only.
 */
export async function listOrgPeople(companyId: string, session: AccessClaims): Promise<OrgPersonRow[]> {
  const scope = teamScopeFilter(session);
  const rows = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] }, ...(scope ?? {}) },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      departmentId: true,
      managerId: true,
      gender: true,
      position: { select: { title: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((e) => ({
    id: e.id,
    name: displayName(e),
    nickname: e.nickname?.trim() || null,
    departmentId: e.departmentId,
    managerId: e.managerId,
    positionTitle: e.position?.title ?? null,
    gender: e.gender ?? null,
  }));
}

// ─────────── Org chart edit mode ───────────

type Placement = { departmentId: string | null; managerId: string | null };

/**
 * Saves the org chart's edit mode (HR / admin): each listed employee gets the
 * given department and direct manager — the manager is who approves their
 * leave / OT. Everything is validated before anything is written: employees,
 * departments and managers must be live records of this company, nobody may
 * manage themself, and the moves together must not create a manager loop.
 * Only fields that actually change are written, in one transaction, then one
 * audit entry per changed employee (after commit: the pool has one
 * connection, so `writeAudit` cannot run beside the open transaction).
 */
export async function applyOrgMoves(
  companyId: string,
  session: AccessClaims,
  input: OrgMovesInput,
  meta?: Meta,
): Promise<{ updated: number }> {
  // One read of every live employee: needed to walk manager chains for loops.
  const everyone = await prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, nickname: true, departmentId: true, managerId: true },
  });
  const byId = new Map(everyone.map((e) => [e.id, e]));
  const nameOf = (id: string) => {
    const e = byId.get(id);
    return e ? displayName(e) : "ไม่ทราบชื่อ";
  };

  for (const m of input.moves) {
    if (!byId.has(m.employeeId)) throw NotFound("ไม่พบพนักงานบางคนในรายการ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้า");
    if (m.managerId && !byId.has(m.managerId)) {
      throw BadRequest(`ไม่พบหัวหน้าที่เลือกให้ ${nameOf(m.employeeId)} อาจถูกลบไปแล้ว กรุณารีเฟรชหน้า`);
    }
  }
  const deptIds = [...new Set(input.moves.map((m) => m.departmentId).filter((id): id is string => !!id))];
  if (deptIds.length > 0) {
    const found = await prisma.department.count({ where: { companyId, deletedAt: null, id: { in: deptIds } } });
    if (found !== deptIds.length) throw BadRequest("ไม่พบแผนกที่เลือก หรือแผนกถูกลบไปแล้ว กรุณารีเฟรชหน้า");
  }

  const problem = checkOrgMoves(everyone, input.moves);
  if (problem?.kind === "duplicate") throw BadRequest(`มี ${nameOf(problem.employeeId)} ซ้ำในรายการ`);
  if (problem?.kind === "self") throw BadRequest(`ตั้ง ${nameOf(problem.employeeId)} เป็นหัวหน้าของตัวเองไม่ได้`);
  if (problem?.kind === "cycle") {
    const chain = [...problem.ids, problem.ids[0]].map(nameOf).join(" → ");
    throw BadRequest(`บันทึกไม่ได้ เพราะหัวหน้าจะวนกันเอง: ${chain}`);
  }

  const changes = input.moves.flatMap((m) => {
    const cur = byId.get(m.employeeId)!;
    const data: Partial<Placement> = {};
    if (cur.departmentId !== m.departmentId) data.departmentId = m.departmentId;
    if (cur.managerId !== m.managerId) data.managerId = m.managerId;
    if (Object.keys(data).length === 0) return [];
    const before: Placement = { departmentId: cur.departmentId, managerId: cur.managerId };
    const after: Placement = { departmentId: m.departmentId, managerId: m.managerId };
    return [{ id: m.employeeId, data, before, after }];
  });
  if (changes.length === 0) return { updated: 0 };

  // Sequential on purpose: the connection pool is 1 (no Promise.all).
  await prisma.$transaction(
    async (tx) => {
      for (const c of changes) {
        await tx.employee.update({ where: { id: c.id }, data: { ...c.data, updatedById: session.sub }, select: { id: true } });
      }
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  for (const c of changes) {
    await writeAudit({
      companyId,
      actorUserId: session.sub,
      action: "employee.org_move",
      entity: "Employee",
      entityId: c.id,
      before: c.before,
      after: c.after,
      ...meta,
    });
  }
  return { updated: changes.length };
}

async function assertCodeFree(companyId: string, code: string, exceptId?: string) {
  const existing = await prisma.department.findFirst({
    where: { companyId, code, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw Conflict(`มีรหัสฝ่าย “${code}” อยู่แล้ว`);
}

/** Walk ancestors of `parentId`; throw if `id` appears (would create a cycle). */
async function assertNoCycle(companyId: string, id: string, parentId: string) {
  let cursor: string | null = parentId;
  let guard = 0;
  while (cursor && guard++ < 50) {
    if (cursor === id) throw BadRequest("ไม่สามารถตั้งฝ่ายย่อยของตนเองได้");
    const parent: { parentId: string | null } | null = await prisma.department.findFirst({
      where: { id: cursor, companyId },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

export async function getDepartment(companyId: string, id: string) {
  const d = await prisma.department.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true, code: true, parentId: true },
  });
  if (!d) throw NotFound("ไม่พบฝ่าย/แผนก");
  return d;
}

export async function createDepartment(
  companyId: string,
  session: AccessClaims,
  input: DepartmentCreateInput,
  meta?: Meta,
) {
  await assertCodeFree(companyId, input.code);
  if (input.parentId) {
    const parent = await prisma.department.findFirst({
      where: { id: input.parentId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw BadRequest("ไม่พบฝ่ายแม่");
  }
  const record = await prisma.department.create({
    data: {
      companyId,
      name: input.name,
      code: input.code,
      parentId: input.parentId ?? null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "department.create",
    entity: "Department",
    entityId: record.id,
    after: { name: input.name, code: input.code },
    ...meta,
  });
  return record;
}

export async function updateDepartment(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: DepartmentUpdateInput,
  meta?: Meta,
) {
  const dept = await prisma.department.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!dept) throw NotFound("ไม่พบฝ่าย");
  if (input.code) await assertCodeFree(companyId, input.code, id);
  if (input.parentId) await assertNoCycle(companyId, id, input.parentId);

  const record = await prisma.department.update({
    where: { id: dept.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "department.update",
    entity: "Department",
    entityId: dept.id,
    ...meta,
  });
  return record;
}

export async function deleteDepartment(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const dept = await prisma.department.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      _count: {
        select: {
          children: { where: { deletedAt: null } },
          employees: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!dept) throw NotFound("ไม่พบฝ่าย");
  if (dept._count.children > 0) throw BadRequest("ลบไม่ได้ — ยังมีแผนกย่อยอยู่ภายใน");
  if (dept._count.employees > 0) throw BadRequest("ลบไม่ได้ — ยังมีพนักงานสังกัดอยู่");

  await prisma.department.update({
    where: { id: dept.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "department.delete",
    entity: "Department",
    entityId: dept.id,
    ...meta,
  });
  return { ok: true as const };
}

// ─────────── Positions ───────────

export async function listPositions(companyId: string): Promise<PositionRow[]> {
  const rows = await prisma.position.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      code: true,
      level: true,
      department: { select: { id: true, name: true } },
      _count: { select: { employees: { where: { deletedAt: null } } } },
    },
    orderBy: [{ level: "desc" }, { title: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    code: p.code,
    level: p.level,
    department: p.department,
    employeeCount: p._count.employees,
  }));
}

async function assertPositionCodeFree(companyId: string, code: string, exceptId?: string) {
  const existing = await prisma.position.findFirst({
    where: { companyId, code, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw Conflict(`มีรหัสตำแหน่ง “${code}” อยู่แล้ว`);
}

export async function getPosition(companyId: string, id: string) {
  const p = await prisma.position.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, title: true, code: true, level: true, departmentId: true },
  });
  if (!p) throw NotFound("ไม่พบตำแหน่ง");
  return p;
}

export async function createPosition(
  companyId: string,
  session: AccessClaims,
  input: PositionCreateInput,
  meta?: Meta,
) {
  await assertPositionCodeFree(companyId, input.code);
  const record = await prisma.position.create({
    data: {
      companyId,
      title: input.title,
      code: input.code,
      level: input.level,
      departmentId: input.departmentId ?? null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "position.create",
    entity: "Position",
    entityId: record.id,
    after: { title: input.title, code: input.code, level: input.level },
    ...meta,
  });
  return record;
}

export async function updatePosition(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: PositionUpdateInput,
  meta?: Meta,
) {
  const pos = await prisma.position.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!pos) throw NotFound("ไม่พบตำแหน่ง");
  if (input.code) await assertPositionCodeFree(companyId, input.code, id);

  const record = await prisma.position.update({
    where: { id: pos.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "position.update",
    entity: "Position",
    entityId: pos.id,
    ...meta,
  });
  return record;
}

export async function deletePosition(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const pos = await prisma.position.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, _count: { select: { employees: { where: { deletedAt: null } } } } },
  });
  if (!pos) throw NotFound("ไม่พบตำแหน่ง");
  if (pos._count.employees > 0) throw BadRequest("ลบไม่ได้ — ยังมีพนักงานในตำแหน่งนี้");

  await prisma.position.update({
    where: { id: pos.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "position.delete",
    entity: "Position",
    entityId: pos.id,
    ...meta,
  });
  return { ok: true as const };
}
