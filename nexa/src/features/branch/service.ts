import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { BranchCreateInput, BranchUpdateInput, BranchRow } from "./schema";

type Meta = { ip?: string; userAgent?: string };

export async function listBranches(companyId: string): Promise<BranchRow[]> {
  const rows = await prisma.branch.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      phone: true,
      lat: true,
      lng: true,
      radiusMeters: true,
      _count: { select: { employees: { where: { deletedAt: null } } } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    address: b.address,
    phone: b.phone,
    employeeCount: b._count.employees,
    hasGeofence: b.lat != null && b.lng != null && b.radiusMeters != null,
  }));
}

export async function getBranch(companyId: string, id: string) {
  const branch = await prisma.branch.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true, code: true, address: true, phone: true },
  });
  if (!branch) throw NotFound("ไม่พบสาขา");
  return branch;
}

async function assertCodeFree(companyId: string, code: string, exceptId?: string) {
  const existing = await prisma.branch.findFirst({
    where: { companyId, code, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw Conflict(`มีรหัสสาขา “${code}” อยู่แล้ว`);
}

export async function createBranch(
  companyId: string,
  input: BranchCreateInput,
  session: SessionUser,
  meta?: Meta,
) {
  await assertCodeFree(companyId, input.code);
  const branch = await prisma.branch.create({
    data: {
      companyId,
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      phone: input.phone ?? null,
      createdById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "branch.create",
    entity: "Branch",
    entityId: branch.id,
    after: { name: input.name, code: input.code },
    ...meta,
  });
  return branch;
}

export async function updateBranch(
  companyId: string,
  id: string,
  input: BranchUpdateInput,
  session: SessionUser,
  meta?: Meta,
) {
  const existing = await prisma.branch.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบสาขา");
  if (input.code) await assertCodeFree(companyId, input.code, id);

  await prisma.branch.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.address !== undefined ? { address: input.address ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      updatedById: session.sub,
    },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "branch.update",
    entity: "Branch",
    entityId: id,
    ...meta,
  });
  return { id };
}

export async function deleteBranch(
  companyId: string,
  id: string,
  session: SessionUser,
  meta?: Meta,
) {
  const branch = await prisma.branch.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, _count: { select: { employees: { where: { deletedAt: null } } } } },
  });
  if (!branch) throw NotFound("ไม่พบสาขา");
  if (branch._count.employees > 0) {
    throw BadRequest("ลบไม่ได้: ยังมีพนักงานสังกัดสาขานี้ กรุณาย้ายพนักงานก่อน");
  }
  await prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "branch.delete",
    entity: "Branch",
    entityId: id,
    ...meta,
  });
  return { id };
}
