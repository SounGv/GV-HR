import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
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
    select: { id: true, firstName: true, lastName: true, nickname: true, employeeCode: true },
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

/** Assets currently assigned to one employee — shown on their profile and checked when they leave. */
export async function listAssetsHeldBy(companyId: string, employeeId: string) {
  return prisma.asset.findMany({
    where: { companyId, deletedAt: null, assignedToEmployeeId: employeeId, status: "ASSIGNED" },
    select: { id: true, assetCode: true, name: true, category: true, assignedAt: true },
    orderBy: { assetCode: "asc" },
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
  // A holder is set only by the assign endpoint, so a new asset cannot start as ASSIGNED.
  if (input.status === "ASSIGNED") throw BadRequest("ใช้ปุ่มเบิกเพื่อระบุผู้ถือทรัพย์สิน");
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
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบทรัพย์สิน");

  // Status and holder move together: only assign / return changes them, so the edit form cannot
  // leave a holder on an "available" asset (the leaver check reads status = ASSIGNED).
  if (input.status !== undefined && input.status !== existing.status) {
    if (input.status === "ASSIGNED") throw BadRequest("ใช้ปุ่มเบิกเพื่อระบุผู้ถือทรัพย์สิน");
    if (existing.status === "ASSIGNED") {
      throw BadRequest("ทรัพย์สินนี้มีผู้ถืออยู่ ให้รับคืนก่อนจึงเปลี่ยนสถานะได้ (รีเฟรชหน้าแล้วลองใหม่)");
    }
  }

  // Guarded on the status we just read, so an assign that lands in between is not overwritten.
  const { count } = await prisma.asset.updateMany({
    where: { id, companyId, deletedAt: null, status: existing.status },
    data: { ...toData(input), updatedById: session.sub },
  });
  if (count === 0) throw Conflict("ทรัพย์สินนี้ถูกเปลี่ยนแปลงไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");
  const asset = await prisma.asset.findFirstOrThrow({ where: { id, companyId }, select });
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
    select: { id: true, assetCode: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบทรัพย์สิน");
  if (existing.status === "ASSIGNED") throw BadRequest("ทรัพย์สินนี้มีผู้ถืออยู่ ให้รับคืนก่อนจึงลบได้");

  // Guarded so an assign that lands after the read cannot be deleted from under its holder.
  const { count } = await prisma.asset.updateMany({
    where: { id, companyId, deletedAt: null, status: { not: "ASSIGNED" } },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  if (count === 0) throw Conflict("ทรัพย์สินนี้ถูกเปลี่ยนแปลงไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");
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
      select: { id: true, status: true },
    });
    if (!emp) throw NotFound("ไม่พบพนักงาน");
    // Handing equipment to someone who already left means it is never coming back.
    if (emp.status === "RESIGNED" || emp.status === "TERMINATED") {
      throw BadRequest("พนักงานคนนี้พ้นสภาพแล้ว เบิกทรัพย์สินให้ไม่ได้");
    }
  }

  // Guarded on the current status: only an AVAILABLE asset can be handed out and only an
  // ASSIGNED one can be taken back, so two HR users cannot both win and a REPAIR / RETIRED asset
  // cannot be assigned.
  const { count } = await prisma.asset.updateMany({
    where: { id, companyId, deletedAt: null, status: employeeId ? "AVAILABLE" : "ASSIGNED" },
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
  });
  if (count === 0) {
    throw Conflict(
      employeeId
        ? "ทรัพย์สินนี้ไม่ได้อยู่ในสถานะว่าง หรือถูกเบิกไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า"
        : "ทรัพย์สินนี้ไม่ได้อยู่ในสถานะถูกเบิก กรุณารีเฟรชหน้า",
    );
  }
  const asset = await prisma.asset.findFirstOrThrow({ where: { id, companyId }, select });

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
