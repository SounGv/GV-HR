import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { KpiView } from "@/features/appraisal-kpi/kpi-view";

export const metadata: Metadata = { title: "KPI Profile" };

export default async function AppraisalKpiPage() {
  await requirePagePermission("campaign:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="KPI Profile" description="ตัวชี้วัดจากข้อมูลเวลาและการลาที่ระบบมีอยู่ พร้อมเกณฑ์ให้คะแนนที่ HR ตั้งเอง" />
      <KpiView />
    </div>
  );
}
