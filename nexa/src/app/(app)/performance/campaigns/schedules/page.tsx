import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { ScheduleTemplateListView } from "@/features/evaluation-schedule/schedule-list-view";

export const metadata: Metadata = { title: "รอบประเมินอัตโนมัติ" };

export default async function EvaluationSchedulesPage() {
  await requirePagePermission("campaign:read");
  return <ScheduleTemplateListView />;
}
