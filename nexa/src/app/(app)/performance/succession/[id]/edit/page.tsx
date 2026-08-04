import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getPlan } from "@/features/succession/service";
import { SuccessionPlanFormPage } from "@/features/succession/plan-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขแผนสืบทอดตำแหน่ง" };

export default async function EditSuccessionPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("succession:update");
  const { id } = await params;

  const plan = await getPlan(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <SuccessionPlanFormPage
      plan={{
        id: plan.id,
        notes: plan.notes,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        position: plan.position,
        incumbentEmployee: plan.incumbentEmployee,
        candidates: plan.candidates,
      }}
    />
  );
}
