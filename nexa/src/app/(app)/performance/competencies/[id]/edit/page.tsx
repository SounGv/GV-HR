import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCompetency } from "@/features/competency/service";
import { CompetencyFormPage } from "@/features/competency/competency-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขสมรรถนะ" };

export default async function EditCompetencyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("campaign:update");
  const { id } = await params;

  const competency = await getCompetency(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <CompetencyFormPage
      competency={{
        id: competency.id,
        name: competency.name,
        description: competency.description,
        exampleBehavior: competency.exampleBehavior,
        categoryId: competency.categoryId,
        category: competency.category,
        order: competency.order,
        active: competency.active,
        createdAt: competency.createdAt.toISOString(),
      }}
    />
  );
}
