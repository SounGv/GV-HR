import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { prisma } from "@/lib/prisma";
import { GoalFormPage } from "@/features/kpi/goal-form-page";

export const metadata: Metadata = { title: "สร้างเป้าหมาย" };

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ parentGoalId?: string }>;
}) {
  const session = await requirePagePermission("kpi:create");
  const { parentGoalId } = await searchParams;

  if (!parentGoalId) return <GoalFormPage />;

  const parent = await prisma.goal.findFirst({
    where: { id: parentGoalId, companyId: session.companyId, deletedAt: null, type: "OKR", parentGoalId: null },
    select: {
      id: true,
      title: true,
      cycle: true,
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
    },
  });
  if (!parent) notFound();

  return <GoalFormPage parentGoal={parent} />;
}
