import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { seedParticipants } from "@/features/campaign/service";
import { createNotification } from "@/features/notification/service";
import { getTemplateSnapshot } from "@/features/evaluation-template/service";
import { bangkokParts } from "@/lib/datetime";
import { addMonthsClamped, formatCycleLabel } from "./cycle";

const DAY_MS = 86_400_000;

/** Tells everyone who can manage campaigns that a scheduled round was drafted and needs opening. */
async function notifyHrDraftCreated(companyId: string, campaignId: string, name: string, participantCount: number) {
  const managers = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      user: { roles: { some: { role: { permissions: { some: { permission: { key: "campaign:manage" } } } } } } },
    },
    select: { id: true },
  });
  for (const m of managers) {
    await createNotification(companyId, m.id, {
      title: "ระบบสร้างรอบประเมินอัตโนมัติ รอเปิดใช้งาน",
      body: `${name} · ผู้เข้าร่วม ${participantCount} คน — ตรวจความพร้อมแล้วกด “เปิดใช้งานแคมเปญ”`,
      category: "performance",
      link: `/performance/campaigns/${campaignId}`,
    });
  }
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
      evaluationTemplateId: true,
      competencies: { select: { competencyId: true, weight: true } },
    },
  });

  let created = 0;
  const errors: { templateId: string; message: string }[] = [];

  for (const template of due) {
    let claimed = false;
    let campaignId: string | null = null;
    try {
      // Template-based schedules must re-validate the Evaluation Template is
      // still ACTIVE right before generating — if it's been archived or left
      // DRAFT since the schedule was set up, this throws and the template is
      // recorded under `errors` instead of silently creating a campaign with
      // the wrong (or no) questions.
      const templateSnapshot = template.evaluationTemplateId
        ? await getTemplateSnapshot(template.companyId, template.evaluationTemplateId)
        : null;

      // Claim the run first: move nextRunAt forward only if it still holds the
      // value we read. A second cron call (or a retry) then sees count 0 and
      // skips, instead of creating a second campaign for the same period. If
      // generation fails below, the claim is rolled back so the next run retries.
      let next = addMonthsClamped(template.nextRunAt, template.intervalMonths);
      // A schedule that was off for several periods makes one round now, not a burst.
      while (next.getTime() <= now.getTime()) next = addMonthsClamped(next, template.intervalMonths);
      const claim = await prisma.evaluationScheduleTemplate.updateMany({
        where: { id: template.id, active: true, deletedAt: null, nextRunAt: template.nextRunAt },
        data: { lastRunAt: now, nextRunAt: next },
      });
      if (claim.count === 0) continue;
      claimed = true;

      // The label names the period the schedule was set for (its nextRunAt), read in Bangkok time.
      const runParts = bangkokParts(template.nextRunAt);
      const today = bangkokParts(now).dateUTC;
      const campaign = await prisma.evaluationCampaign.create({
        data: {
          companyId: template.companyId,
          name: `${template.name} (อัตโนมัติ)`,
          cycle: formatCycleLabel(runParts.year, runParts.month, template.intervalMonths),
          startDate: today,
          endDate: new Date(today.getTime() + template.durationDays * DAY_MS),
          status: "DRAFT",
          raterTypes: template.raterTypes,
          scheduleTemplateId: template.id,
          ...(templateSnapshot
            ? { templateId: templateSnapshot.templateId, templateSnapshot: templateSnapshot as object }
            : {
                competencies: {
                  create: template.competencies.map((c) => ({ competencyId: c.competencyId, weight: c.weight })),
                },
              }),
        },
        select: { id: true },
      });
      campaignId = campaign.id;

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

      await writeAudit({
        companyId: template.companyId,
        actorUserId: null,
        action: "campaign.auto_generate",
        entity: "EvaluationCampaign",
        entityId: campaign.id,
        after: { scheduleTemplateId: template.id, participantCount: employees.length },
      });

      // The round is created as DRAFT (someone still has to open it), but
      // nobody was told it exists — it sat unnoticed until HR happened to
      // browse the campaign list. A failure here must not mark the template
      // as failed: the campaign and its next run date are already saved.
      try {
        await notifyHrDraftCreated(template.companyId, campaign.id, `${template.name} (อัตโนมัติ)`, employees.length);
      } catch {
        // Notification is best-effort.
      }

      created += 1;
    } catch (err) {
      // Undo the claim and drop the half-built draft so the next run starts clean.
      if (claimed) {
        try {
          if (campaignId) {
            await prisma.evaluationCampaign.updateMany({
              where: { id: campaignId, status: "DRAFT", deletedAt: null },
              data: { deletedAt: new Date() },
            });
          }
          await prisma.evaluationScheduleTemplate.updateMany({
            where: { id: template.id },
            data: { nextRunAt: template.nextRunAt },
          });
        } catch {
          // Best-effort rollback; the error below still reports the failure.
        }
      }
      errors.push({ templateId: template.id, message: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return { processed: due.length, created, errors };
}
