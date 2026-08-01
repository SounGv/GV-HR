import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { CostCenterCreateInput, CostCenterUpdateInput, CostCenterRow } from "./schema";

type Meta = { ip?: string; userAgent?: string };

export async function listCostCenters(companyId: string): Promise<CostCenterRow[]> {
  const rows = await prisma.costCenter.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      _count: { select: { employees: { where: { deletedAt: null } } } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    employeeCount: c._count.employees,
  }));
}

async function assertCodeFree(companyId: string, code: string, exceptId?: string) {
  const existing = await prisma.costCenter.findFirst({
    where: { companyId, code, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw Conflict(`มีรหัสศูนย์ต้นทุน “${code}” อยู่แล้ว`);
}

export async function createCostCenter(
  companyId: string,
  input: CostCenterCreateInput,
  session: SessionUser,
  meta?: Meta,
) {
  await assertCodeFree(companyId, input.code);
  const rec = await prisma.costCenter.create({
    data: {
      companyId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      createdById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({ companyId, actorUserId: session.sub, action: "cost_center.create", entity: "CostCenter", entityId: rec.id, after: { code: input.code, name: input.name }, ...meta });
  return rec;
}

export async function updateCostCenter(
  companyId: string,
  id: string,
  input: CostCenterUpdateInput,
  session: SessionUser,
  meta?: Meta,
) {
  const existing = await prisma.costCenter.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!existing) throw NotFound("ไม่พบศูนย์ต้นทุน");
  if (input.code) await assertCodeFree(companyId, input.code, id);
  await prisma.costCenter.update({
    where: { id },
    data: {
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      updatedById: session.sub,
    },
  });
  await writeAudit({ companyId, actorUserId: session.sub, action: "cost_center.update", entity: "CostCenter", entityId: id, ...meta });
  return { id };
}

export async function deleteCostCenter(companyId: string, id: string, session: SessionUser, meta?: Meta) {
  const rec = await prisma.costCenter.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, _count: { select: { employees: { where: { deletedAt: null } } } } },
  });
  if (!rec) throw NotFound("ไม่พบศูนย์ต้นทุน");
  if (rec._count.employees > 0) throw BadRequest("ลบไม่ได้: ยังมีพนักงานผูกกับศูนย์ต้นทุนนี้");
  await prisma.costCenter.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "cost_center.delete", entity: "CostCenter", entityId: id, ...meta });
  return { id };
}
