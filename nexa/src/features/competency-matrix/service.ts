import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { SetPositionRequirementsInput, SetEmployeeLevelsInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

export interface CompetencyRow {
  competencyId: string;
  competencyName: string;
  categoryName: string | null;
  requiredLevel: number | null;
}

export interface EmployeeGapRow extends CompetencyRow {
  assessedLevel: number | null;
  gap: number | null; // requiredLevel - assessedLevel; null if either side is unset
  note: string | null;
  assessedAt: string | null;
}

async function listActiveCompetencies(companyId: string) {
  return prisma.competency.findMany({
    where: { companyId, deletedAt: null, active: true },
    select: { id: true, name: true, category: { select: { name: true } } },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
  });
}

export async function getPositionRequirements(companyId: string, positionId: string): Promise<CompetencyRow[]> {
  const position = await prisma.position.findFirst({
    where: { id: positionId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!position) throw NotFound("ไม่พบตำแหน่ง");

  const competencies = await listActiveCompetencies(companyId);
  const requirements = await prisma.positionCompetencyRequirement.findMany({
    where: { positionId },
    select: { competencyId: true, requiredLevel: true },
  });
  const reqMap = new Map(requirements.map((r) => [r.competencyId, r.requiredLevel]));

  return competencies.map((c) => ({
    competencyId: c.id,
    competencyName: c.name,
    categoryName: c.category?.name ?? null,
    requiredLevel: reqMap.get(c.id) ?? null,
  }));
}

/** Sequential upserts (never Promise.all) — the pooled connection here supports only one query at a time. */
export async function setPositionRequirements(
  companyId: string,
  session: AccessClaims,
  positionId: string,
  input: SetPositionRequirementsInput,
  meta?: Meta,
) {
  const position = await prisma.position.findFirst({
    where: { id: positionId, companyId, deletedAt: null },
    select: { id: true, title: true },
  });
  if (!position) throw NotFound("ไม่พบตำแหน่ง");

  for (const item of input.items) {
    if (item.level === 0) {
      await prisma.positionCompetencyRequirement.deleteMany({
        where: { positionId, competencyId: item.competencyId },
      });
    } else {
      await prisma.positionCompetencyRequirement.upsert({
        where: { positionId_competencyId: { positionId, competencyId: item.competencyId } },
        create: {
          companyId,
          positionId,
          competencyId: item.competencyId,
          requiredLevel: item.level,
          createdById: session.sub,
          updatedById: session.sub,
        },
        update: { requiredLevel: item.level, updatedById: session.sub },
      });
    }
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency_matrix.set_position_requirements",
    entity: "Position",
    entityId: positionId,
    after: { title: position.title, items: input.items },
    ...meta,
  });

  return getPositionRequirements(companyId, positionId);
}

export async function getEmployeeCompetencyGap(companyId: string, employeeId: string): Promise<EmployeeGapRow[]> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true, positionId: true },
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  const competencies = await listActiveCompetencies(companyId);
  const requirements = employee.positionId
    ? await prisma.positionCompetencyRequirement.findMany({
        where: { positionId: employee.positionId },
        select: { competencyId: true, requiredLevel: true },
      })
    : [];
  const levels = await prisma.employeeCompetencyLevel.findMany({
    where: { employeeId },
    select: { competencyId: true, level: true, note: true, assessedAt: true },
  });

  const reqMap = new Map(requirements.map((r) => [r.competencyId, r.requiredLevel]));
  const levelMap = new Map(levels.map((l) => [l.competencyId, l]));

  return competencies.map((c) => {
    const required = reqMap.get(c.id) ?? null;
    const assessed = levelMap.get(c.id);
    return {
      competencyId: c.id,
      competencyName: c.name,
      categoryName: c.category?.name ?? null,
      requiredLevel: required,
      assessedLevel: assessed?.level ?? null,
      gap: required != null && assessed?.level != null ? required - assessed.level : null,
      note: assessed?.note ?? null,
      assessedAt: assessed?.assessedAt ? assessed.assessedAt.toISOString() : null,
    };
  });
}

export async function setEmployeeCompetencyLevels(
  companyId: string,
  session: AccessClaims,
  employeeId: string,
  input: SetEmployeeLevelsInput,
  meta?: Meta,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  for (const item of input.items) {
    if (item.level === 0) {
      await prisma.employeeCompetencyLevel.deleteMany({
        where: { employeeId, competencyId: item.competencyId },
      });
    } else {
      await prisma.employeeCompetencyLevel.upsert({
        where: { employeeId_competencyId: { employeeId, competencyId: item.competencyId } },
        create: {
          companyId,
          employeeId,
          competencyId: item.competencyId,
          level: item.level,
          note: item.note,
          assessedById: session.sub,
          assessedAt: new Date(),
        },
        update: { level: item.level, note: item.note, assessedById: session.sub, assessedAt: new Date() },
      });
    }
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency_matrix.set_employee_levels",
    entity: "Employee",
    entityId: employeeId,
    after: { items: input.items },
    ...meta,
  });

  return getEmployeeCompetencyGap(companyId, employeeId);
}
