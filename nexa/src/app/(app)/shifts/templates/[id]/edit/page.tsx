import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getTemplate } from "@/features/shift/service";
import { TemplateFormPage } from "@/features/shift/template-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขกะ" };

export default async function EditShiftTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("shift:update");
  const { id } = await params;

  const t = await getTemplate(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <TemplateFormPage template={t} />;
}
