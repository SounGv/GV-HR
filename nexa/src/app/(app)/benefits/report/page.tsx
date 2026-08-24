import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { BenefitsReportView } from "@/features/benefits/report-view";

export const metadata: Metadata = { title: "รายงานสวัสดิการ" };

/** HR/Admin only — expense:approve, matching every other finance-facing report in this app. */
export default async function BenefitsReportPage() {
  await requirePagePermission("expense:approve");

  return (
    <div className="space-y-6">
      <PageHeader title="รายงานสวัสดิการ" description="ค่ารักษาพยาบาลและกู้เงินบริษัท — สำหรับ HR/Admin" />
      <BenefitsReportView />
    </div>
  );
}
