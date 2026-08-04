import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCompetencyCategory } from "@/features/competency-category/service";
import { CompetencyCategoryFormPage } from "@/features/competency-category/category-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขหมวดหมู่สมรรถนะ" };

export default async function EditCompetencyCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("campaign:update");
  const { id } = await params;

  const category = await getCompetencyCategory(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <CompetencyCategoryFormPage
      category={{
        id: category.id,
        name: category.name,
        order: category.order,
        createdAt: category.createdAt.toISOString(),
      }}
    />
  );
}
