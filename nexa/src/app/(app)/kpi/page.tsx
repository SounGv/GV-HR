import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { KpiView } from "@/features/kpi/kpi-view";

export const metadata: Metadata = { title: "KPI & Level" };

export default async function KpiPage() {
  await requirePagePermission("kpi:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI & เป้าหมาย"
        description="ติดตามเป้าหมายและ KPI รายบุคคล พร้อมความคืบหน้าตามรอบการประเมิน"
      />
      <KpiView />
    </div>
  );
}
