import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { seedParticipants } from "@/features/campaign/service";

const DAY_MS = 86_400_000;

function formatCycleLabel(date: Date, intervalMonths: number): string {
  const beYear = date.getFullYear() + 543;
  if (intervalMonths >= 12) return `ประจำปี ${beYear}`;
  if (intervalMonths >= 6) return `ครึ่งปี ${date.getMonth() < 6 ? 1 : 2}/${beYear}`;
  if (intervalMonths >= 3) return `ไตรมาส ${Math.floor(date.getMonth() / 3) + 1}/${beYear}`;
  return `เดือน ${date.getMonth() + 1}/${beYear}`;
}

/**
 * Cron entrypoint (see `src/app/api/cron/evaluation-schedules/route.ts`). Runs
 * across all companies. Each due template is generated in its own try/catch
 * so one bad template can't block the rest from running.
 */
export async function runDueSchedules() {
  const now = new Date();
  const due = await prisma.evaluationScheduleTemplate.findMany({
    where: { active: true, deletedAt: null, nextRunAt: { lte: now } },
    select: {
      id: true,
      companyId: true,
      name: true,
      departmentId: true,
      intervalMonths: true,
      durationDays: true,
      raterTypes: true,
      nextRunAt: true,
      competencies: { select: { competencyId: true, weight: true } },
    },
  });

  let created = 0;
  const errors: { templateId: string; message: string }[] = [];

  for (const template of due) {
    try {
      const campaign = await prisma.evaluationCampaign.create({
        data: {
          companyId: template.companyId,
          name: `${template.name} (อัตโนมัติ)`,
          cycle: formatCycleLabel(now, template.intervalMonths),
          startDate: now,
          endDate: new Date(now.getTime() + template.durationDays * DAY_MS),
          status: "DRAFT",
          raterTypes: template.raterTypes,
          scheduleTemplateId: template.id,
          competencies: {
            create: template.competencies.map((c) => ({ competencyId: c.competencyId, weight: c.weight })),
          },
        },
        select: { id: true },
      });

      const employees = await prisma.employee.findMany({
        where: {
          companyId: template.companyId,
          departmentId: template.departmentId,
          deletedAt: null,
          status: "ACTIVE",
        },
        select: { id: true, managerId: true },
      });
      if (employees.length > 0) {
        await seedParticipants(campaign.id, template.raterTypes, employees);
      }

      const next = new Date(template.nextRunAt);
      next.setMonth(next.getMonth() + template.intervalMonths);

      await prisma.evaluationScheduleTemplate.update({
        where: { id: template.id },
        data: { lastRunAt: now, nextRunAt: next },
      });

      await writeAudit({
        companyId: template.companyId,
        actorUserId: null,
        action: "campaign.auto_generate",
        entity: "EvaluationCampaign",
        entityId: campaign.id,
        after: { scheduleTemplateId: template.id, participantCount: employees.length },
      });

      created += 1;
    } catch (err) {
      errors.push({ templateId: template.id, message: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return { processed: due.length, created, errors };
}
