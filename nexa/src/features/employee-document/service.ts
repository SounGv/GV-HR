import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { EmployeeDocumentCreateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const documentSelect = {
  id: true,
  type: true,
  label: true,
  fileUrl: true,
  uploadedAt: true,
} as const;

export async function listEmployeeDocuments(companyId: string, employeeId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null }, select: { id: true } });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  return prisma.employeeDocument.findMany({
    where: { employeeId, companyId },
    select: documentSelect,
    orderBy: { uploadedAt: "desc" },
  });
}

export async function addEmployeeDocument(
  companyId: string,
  session: AccessClaims,
  employeeId: string,
  input: EmployeeDocumentCreateInput,
  meta?: Meta,
) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null }, select: { id: true } });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  const doc = await prisma.employeeDocument.create({
    data: {
      companyId,
      employeeId,
      type: input.type,
      label: input.label,
      fileUrl: input.fileUrl,
      createdById: session.sub,
    },
    select: documentSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee_document.create",
    entity: "EmployeeDocument",
    entityId: doc.id,
    after: { employeeId, type: input.type, label: input.label },
    ...meta,
  });

  return doc;
}

export async function removeEmployeeDocument(
  companyId: string,
  session: AccessClaims,
  employeeId: string,
  documentId: string,
  meta?: Meta,
) {
  const doc = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId, companyId },
    select: { id: true, type: true, label: true },
  });
  if (!doc) throw NotFound("ไม่พบเอกสาร");

  await prisma.employeeDocument.delete({ where: { id: doc.id } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "employee_document.delete",
    entity: "EmployeeDocument",
    entityId: doc.id,
    before: { employeeId, type: doc.type, label: doc.label },
    ...meta,
  });

  return { ok: true as const };
}
