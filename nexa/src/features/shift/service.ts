import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { ShiftAssignment } from "./types";
import type {
  TemplateCreateInput,
  TemplateUpdateInput,
  AssignmentUpsertInput,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

const templateSelect = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  color: true,
  breakMinutes: true,
} satisfies Prisma.ShiftTemplateSelect;

export async function listTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId, deletedAt: null },
    select: templateSelect,
    orderBy: { startTime: "asc" },
  });
}

export async function getTemplate(companyId: string, id: string) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: templateSelect,
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  return tpl;
}

export async function createTemplate(
  companyId: string,
  session: AccessClaims,
  input: TemplateCreateInput,
  meta?: Meta,
) {
  const record = await prisma.shiftTemplate.create({
    data: {
      companyId,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color,
      breakMinutes: input.breakMinutes,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: templateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.create",
    entity: "ShiftTemplate",
    entityId: record.id,
    ...meta,
  });
  return record;
}

export async function updateTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: TemplateUpdateInput,
  meta?: Meta,
) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  const record = await prisma.shiftTemplate.update({
    where: { id: tpl.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.breakMinutes !== undefined ? { breakMinutes: input.breakMinutes } : {}),
      updatedById: session.sub,
    },
    select: templateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.update",
    entity: "ShiftTemplate",
    entityId: tpl.id,
    ...meta,
  });
  return record;
}

export async function deleteTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  // Remove assignments then soft-delete the template.
  await prisma.shiftAssignment.deleteMany({ where: { companyId, templateId: tpl.id } });
  await prisma.shiftTemplate.update({
    where: { id: tpl.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.delete",
    entity: "ShiftTemplate",
    entityId: tpl.id,
    ...meta,
  });
  return { ok: true as const };
}

export async function listAssignments(
  companyId: string,
  from: string,
  to: string,
): Promise<ShiftAssignment[]> {
  const rows = await prisma.shiftAssignment.findMany({
    where: {
      companyId,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    select: {
      id: true,
      date: true,
      employeeId: true,
      note: true,
      template: {
        select: { id: true, name: true, startTime: true, endTime: true, color: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    employeeId: r.employeeId,
    note: r.note,
    template: r.template,
  }));
}

export async function upsertAssignment(
  companyId: string,
  session: AccessClaims,
  input: AssignmentUpsertInput,
  meta?: Meta,
) {
  const [employee, template] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: input.employeeId, companyId, deletedAt: null },
      select: { id: true },
    }),
    prisma.shiftTemplate.findFirst({
      where: { id: input.templateId, companyId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!employee) throw BadRequest("ไม่พบพนักงาน");
  if (!template) throw BadRequest("ไม่พบกะการทำงาน");

  const record = await prisma.shiftAssignment.upsert({
    where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
    create: {
      companyId,
      employeeId: input.employeeId,
      templateId: input.templateId,
      date: input.date,
      note: input.note,
      createdById: session.sub,
      updatedById: session.sub,
    },
    update: {
      templateId: input.templateId,
      note: input.note,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.assign",
    entity: "ShiftAssignment",
    entityId: record.id,
    ...meta,
  });
  return record;
}

export async function deleteAssignment(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const asg = await prisma.shiftAssignment.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!asg) throw NotFound("ไม่พบเวรที่มอบหมาย");
  await prisma.shiftAssignment.delete({ where: { id: asg.id } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.unassign",
    entity: "ShiftAssignment",
    entityId: asg.id,
    ...meta,
  });
  return { ok: true as const };
}
