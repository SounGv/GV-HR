import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { AssetCreateInput, AssetListQuery, AssetUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const select = {
  id: true,
  assetCode: true,
  name: true,
  category: true,
  serialNumber: true,
  status: true,
  assignedAt: true,
  purchaseDate: true,
  purchasePrice: true,
  note: true,
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  },
} satisfies Prisma.AssetSelect;

function toData(input: AssetUpdateInput) {
  const { purchasePrice, ...rest } = input;
  return {
    ...rest,
    ...(purchasePrice !== undefined ? { purchasePrice: Math.round(purchasePrice) } : {}),
  };
}

export async function listAssets(companyId: string, query: AssetListQuery) {
  return prisma.asset.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { assetCode: { contains: query.search, mode: "insensitive" } },
              { serialNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select,
    orderBy: { assetCode: "asc" },
    take: 500,
  });
}

export async function getAsset(companyId: string, id: string) {
  const asset = await prisma.asset.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!asset) throw NotFound("ไม่พบทรัพย์สิน");
  return asset;
}

export async function createAsset(
  companyId: string,
  session: AccessClaims,
  input: AssetCreateInput,
  meta?: Meta,
) {
  const { purchasePrice, ...rest } = input;
  const asset = await prisma.asset.create({
    data: {
      ...rest,
      ...(purchasePrice !== undefined ? { purchasePrice: Math.round(purchasePrice) } : {}),
      companyId,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "asset.create",
    entity: "Asset",
    entityId: asset.id,
    after: { assetCode: input.assetCode, name: input.name },
    ...meta,
  });
  return asset;
}

export async function updateAsset(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: AssetUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.asset.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบทรัพย์สิน");

  const asset = await prisma.asset.update({
    where: { id },
    data: { ...toData(input), updatedById: session.sub },
    select,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "asset.update",
    entity: "Asset",
    entityId: id,
    ...meta,
  });
  return asset;
}

export async function deleteAsset(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.asset.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, assetCode: true },
  });
  if (!existing) throw NotFound("ไม่พบทรัพย์สิน");

  await prisma.asset.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "asset.delete",
    entity: "Asset",
    entityId: id,
    before: { assetCode: existing.assetCode },
    ...meta,
  });
}

/** Assign to an employee, or pass null to return the asset to the pool. */
export async function assignAsset(
  companyId: string,
  session: AccessClaims,
  id: string,
  employeeId: string | null,
  meta?: Meta,
) {
  const existing = await prisma.asset.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบทรัพย์สิน");

  if (employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!emp) throw NotFound("ไม่พบพนักงาน");
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: employeeId
      ? {
          assignedToEmployeeId: employeeId,
          status: "ASSIGNED",
          assignedAt: new Date(),
          updatedById: session.sub,
        }
      : {
          assignedToEmployeeId: null,
          status: "AVAILABLE",
          assignedAt: null,
          updatedById: session.sub,
        },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: employeeId ? "asset.assign" : "asset.unassign",
    entity: "Asset",
    entityId: id,
    after: { employeeId },
    ...meta,
  });

  return asset;
}
