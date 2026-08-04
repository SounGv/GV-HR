import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getScheduleTemplate } from "@/features/evaluation-schedule/service";
import { ScheduleTemplateFormPage } from "@/features/evaluation-schedule/schedule-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขรอบประเมินอัตโนมัติ" };

export default async function EditEvaluationSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("campaign:update");
  const { id } = await params;

  const template = await getScheduleTemplate(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <ScheduleTemplateFormPage
      template={{
        ...template,
        nextRunAt: template.nextRunAt.toISOString(),
        lastRunAt: template.lastRunAt?.toISOString() ?? null,
      }}
    />
  );
}
