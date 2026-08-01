import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { GeofenceInput } from "./schema";

const branchSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  lat: true,
  lng: true,
  radiusMeters: true,
} satisfies Prisma.BranchSelect;

type Meta = { ip?: string; userAgent?: string };

export async function listGeofences(companyId: string) {
  return prisma.branch.findMany({
    where: { companyId, deletedAt: null },
    select: branchSelect,
    orderBy: { code: "asc" },
  });
}

export async function updateGeofence(
  companyId: string,
  input: GeofenceInput,
  session: SessionUser,
  meta?: Meta,
) {
  const result = await prisma.branch.updateMany({
    where: { id: input.branchId, companyId, deletedAt: null },
    data: {
      lat: input.lat,
      lng: input.lng,
      radiusMeters: input.radiusMeters,
      updatedById: session.sub,
    },
  });
  if (result.count === 0) throw NotFound("ไม่พบสาขา");

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "geofence.update",
    entity: "Branch",
    entityId: input.branchId,
    after: { lat: input.lat, lng: input.lng, radiusMeters: input.radiusMeters },
    ...meta,
  });

  return prisma.branch.findUniqueOrThrow({ where: { id: input.branchId }, select: branchSelect });
}
