import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getTemplate } from "@/features/evaluation-template/service";
import { TemplateFormPage } from "@/features/evaluation-template/template-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขแบบประเมิน" };

export default async function EditEvaluationTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("campaign:update");
  const { id } = await params;

  const template = await getTemplate(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <TemplateFormPage
      template={{
        ...template,
        updatedAt: template.updatedAt.toISOString(),
      }}
    />
  );
}
