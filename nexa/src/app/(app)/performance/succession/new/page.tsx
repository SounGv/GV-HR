import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { SuccessionPlanFormPage } from "@/features/succession/plan-form-page";

export const metadata: Metadata = { title: "สร้างแผนสืบทอดตำแหน่ง" };

export default async function NewSuccessionPlanPage() {
  await requirePagePermission("succession:create");
  return <SuccessionPlanFormPage />;
}
