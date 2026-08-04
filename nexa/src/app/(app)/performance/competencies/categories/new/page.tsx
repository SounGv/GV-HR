import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CompetencyCategoryFormPage } from "@/features/competency-category/category-form-page";

export const metadata: Metadata = { title: "เพิ่มหมวดหมู่สมรรถนะ" };

export default async function NewCompetencyCategoryPage() {
  await requirePagePermission("campaign:create");
  return <CompetencyCategoryFormPage />;
}
