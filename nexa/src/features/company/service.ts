import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CompanyProfileInput } from "./schema";

const profileSelect = {
  id: true,
  name: true,
  legalName: true,
  taxId: true,
  logoUrl: true,
  logoDarkUrl: true,
  faviconUrl: true,
  signatureUrl: true,
  stampUrl: true,
  brandColor: true,
  timezone: true,
  currency: true,
  language: true,
  phone: true,
  email: true,
  website: true,
  googleMapsUrl: true,
  addressLine: true,
  subDistrict: true,
  district: true,
  province: true,
  postalCode: true,
  country: true,
  attendanceDeductionEnabled: true,
  lateDeductionPerOccurrence: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

type Meta = { ip?: string; userAgent?: string };

export async function getCompanyProfile(companyId: string) {
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: profileSelect,
  });
  if (!company) throw NotFound("ไม่พบข้อมูลบริษัท");
  return company;
}

export async function updateCompanyProfile(
  companyId: string,
  input: CompanyProfileInput,
  session: AccessClaims,
  meta?: Meta,
) {
  // zod has already trimmed and converted empty strings to null.
  const { lateDeductionPerOccurrence, ...rest } = input;
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...rest,
      ...(lateDeductionPerOccurrence !== undefined
        ? { lateDeductionPerOccurrence: new Prisma.Decimal(lateDeductionPerOccurrence) }
        : {}),
      updatedById: session.sub,
    },
    select: profileSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "company.update",
    entity: "Company",
    entityId: companyId,
    // Keep the audit payload light — never store large image data URLs.
    after: { name: updated.name, taxId: updated.taxId, brandColor: updated.brandColor },
    ...meta,
  });

  return updated;
}
