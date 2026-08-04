import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PlanDetailView } from "@/features/succession/plan-detail-view";

export const metadata: Metadata = { title: "แผนสืบทอดตำแหน่ง" };

export default async function SuccessionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("succession:read");
  const { id } = await params;
  return <PlanDetailView planId={id} />;
}
