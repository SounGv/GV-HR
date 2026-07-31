import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { DepartmentRow, PositionRow } from "./types";
import type {
  DepartmentCreateInput,
  DepartmentUpdateInput,
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
