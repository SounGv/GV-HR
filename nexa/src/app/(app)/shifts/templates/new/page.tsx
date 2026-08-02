import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { TemplateFormPage } from "@/features/shift/template-form-page";

export const metadata: Metadata = { title: "สร้างกะการทำงาน" };

export default async function NewShiftTemplatePage() {
  await requirePagePermission("shift:create");
  return <TemplateFormPage />;
}
