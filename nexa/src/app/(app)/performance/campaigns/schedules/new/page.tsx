import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { ScheduleTemplateFormPage } from "@/features/evaluation-schedule/schedule-form-page";

export const metadata: Metadata = { title: "สร้างรอบประเมินอัตโนมัติ" };

export default async function NewEvaluationSchedulePage() {
  await requirePagePermission("campaign:create");
  return <ScheduleTemplateFormPage />;
}
