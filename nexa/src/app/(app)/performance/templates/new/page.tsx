import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { TemplateFormPage } from "@/features/evaluation-template/template-form-page";

export const metadata: Metadata = { title: "สร้างแบบประเมิน" };

export default async function NewEvaluationTemplatePage() {
  await requirePagePermission("campaign:create");
  return <TemplateFormPage />;
}
