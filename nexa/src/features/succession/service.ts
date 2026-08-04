import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CandidateCreateInput, CandidateUpdateInput, PlanCreateInput, PlanUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const employeeRefSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} satisfies Prisma.EmployeeSelect;

const candidateSelect = {
  id: true,
  readiness: true,
  note: true,
  rank: true,
  employee: { select: employeeRefSelect },
} satisfies Prisma.SuccessionCandidateSelect;

const planSelect = {
  id: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  position: { select: { id: true, title: true, code: true } },
  incumbentEmployee: { select: employeeRefSelect },
} satisfies Prisma.SuccessionPlanSelect;

export async function listPlans(companyId: string) {
  const rows = await prisma.successionPlan.findMany({
    where: { companyId },
    select: { ...planSelect, _count: { select: { candidates: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    notes: r.notes,
    createdAt: r.createdAt,
    position: r.position,
    incumbentEmployee: r.incumbentEmployee,
    candidateCount: r._count.candidates,
  }));
}

export async function getPlan(companyId: string, id: string) {
  const plan = await prisma.successionPlan.findFirst({
    where: { id, companyId },
    select: { ...planSelect, candidates: { select: candidateSelect, orderBy: { rank: "asc" } } },
  });
  if (!plan) throw NotFound("ไม่พบแผนสืบทอดตำแหน่ง");
  return plan;
}

export async function createPlan(companyId: string, session: AccessClaims, input: PlanCreateInput, meta?: Meta) {
  const position = await prisma.position.findFirst({
    where: { id: input.positionId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!position) throw NotFound("ไม่พบตำแหน่งงาน");

  const existing = await prisma.successionPlan.findUnique({
    where: { companyId_positionId: { companyId, positionId: input.positionId } },
    select: { id: true },
  });
  if (existing) throw Conflict("แผนสำหรับตำแหน่งนี้มีอยู่แล้ว");

  const plan = await prisma.successionPlan.create({
    data: {
      companyId,
      positionId: input.positionId,
      incumbentEmployeeId: input.incumbentEmployeeId,
      notes: input.notes,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.create_plan",
    entity: "SuccessionPlan",
    entityId: plan.id,
    after: { positionId: input.positionId },
    ...meta,
  });

  return { id: plan.id };
}

export async function updatePlan(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: PlanUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.successionPlan.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) throw NotFound("ไม่พบแผนสืบทอดตำแหน่ง");

  await prisma.successionPlan.update({
    where: { id },
    data: {
      ...(input.incumbentEmployeeId !== undefined ? { incumbentEmployeeId: input.incumbentEmployeeId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedById: session.sub,
    },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.update_plan",
    entity: "SuccessionPlan",
    entityId: id,
    ...meta,
  });

  return { id };
}

export async function deletePlan(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.successionPlan.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) throw NotFound("ไม่พบแผนสืบทอดตำแหน่ง");

  await prisma.successionPlan.delete({ where: { id } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.delete_plan",
    entity: "SuccessionPlan",
    entityId: id,
    ...meta,
  });
}

export async function addCandidate(
  companyId: string,
  session: AccessClaims,
  planId: string,
  input: CandidateCreateInput,
  meta?: Meta,
) {
  const plan = await prisma.successionPlan.findFirst({ where: { id: planId, companyId }, select: { id: true } });
  if (!plan) throw NotFound("ไม่พบแผนสืบทอดตำแหน่ง");

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  const existing = await prisma.successionCandidate.findUnique({
    where: { planId_employeeId: { planId, employeeId: input.employeeId } },
    select: { id: true },
  });
  if (existing) throw BadRequest("พนักงานคนนี้อยู่ในรายชื่อผู้สืบทอดแล้ว");

  const candidate = await prisma.successionCandidate.create({
    data: {
      planId,
      employeeId: input.employeeId,
      readiness: input.readiness,
      note: input.note,
      rank: input.rank,
    },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.add_candidate",
    entity: "SuccessionPlan",
    entityId: planId,
    after: { employeeId: input.employeeId, readiness: input.readiness },
    ...meta,
  });

  return { id: candidate.id };
}

export async function updateCandidate(
  companyId: string,
  session: AccessClaims,
  candidateId: string,
  input: CandidateUpdateInput,
  meta?: Meta,
) {
  const candidate = await prisma.successionCandidate.findFirst({
    where: { id: candidateId, plan: { companyId } },
    select: { id: true, planId: true },
  });
  if (!candidate) throw NotFound("ไม่พบผู้สืบทอด");

  await prisma.successionCandidate.update({
    where: { id: candidateId },
    data: {
      ...(input.readiness !== undefined ? { readiness: input.readiness } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.rank !== undefined ? { rank: input.rank } : {}),
    },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.update_candidate",
    entity: "SuccessionPlan",
    entityId: candidate.planId,
    after: input,
    ...meta,
  });

  return { id: candidateId };
}

export async function removeCandidate(companyId: string, session: AccessClaims, candidateId: string, meta?: Meta) {
  const candidate = await prisma.successionCandidate.findFirst({
    where: { id: candidateId, plan: { companyId } },
    select: { id: true, planId: true },
  });
  if (!candidate) throw NotFound("ไม่พบผู้สืบทอด");

  await prisma.successionCandidate.delete({ where: { id: candidateId } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "succession.remove_candidate",
    entity: "SuccessionPlan",
    entityId: candidate.planId,
    ...meta,
  });
}
