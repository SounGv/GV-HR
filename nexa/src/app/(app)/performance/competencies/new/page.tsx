import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CompetencyFormPage } from "@/features/competency/competency-form-page";

export const metadata: Metadata = { title: "เพิ่มสมรรถนะ" };

export default async function NewCompetencyPage() {
  await requirePagePermission("campaign:create");
  return <CompetencyFormPage />;
}
