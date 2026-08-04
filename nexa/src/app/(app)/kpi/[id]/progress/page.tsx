import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getGoal } from "@/features/kpi/service";
import { GoalProgressFormPage } from "@/features/kpi/progress-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "อัปเดตความคืบหน้า" };

export default async function GoalProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("kpi:read");
  const { id } = await params;

  const g = await getGoal(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <GoalProgressFormPage
      goal={{
        id: g.id,
        title: g.title,
        description: g.description,
        type: g.type,
        cycle: g.cycle,
        unit: g.unit,
        targetValue: Number(g.targetValue),
        currentValue: Number(g.currentValue),
        weight: g.weight,
        status: g.status,
        dueDate: g.dueDate ? g.dueDate.toISOString() : null,
        createdAt: g.createdAt.toISOString(),
        employee: g.employee,
      }}
    />
  );
}
