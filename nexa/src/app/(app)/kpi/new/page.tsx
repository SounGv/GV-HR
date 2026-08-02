import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { GoalFormPage } from "@/features/kpi/goal-form-page";

export const metadata: Metadata = { title: "สร้างเป้าหมาย" };

export default async function NewGoalPage() {
  await requirePagePermission("kpi:create");
  return <GoalFormPage />;
}
