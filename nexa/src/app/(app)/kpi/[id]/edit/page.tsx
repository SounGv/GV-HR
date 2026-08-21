import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getGoal } from "@/features/kpi/service";
import { GoalFormPage } from "@/features/kpi/goal-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขเป้าหมาย" };

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("kpi:update");
  const { id } = await params;

  const g = await getGoal(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <GoalFormPage
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
        parentGoalId: g.parentGoalId,
        keyResults: g.keyResults,
        rollup: g.rollup,
        employee: g.employee,
      }}
    />
  );
}
