import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ReportView } from "@/features/report/report-view";

export const metadata: Metadata = { title: "รายงานและวิเคราะห์" };

export default async function ReportsPage() {
  await requirePagePermission("report:read");

  return (
    <div className="space-y-6">
      <PageHeader title="รายงานและวิเคราะห์" description="สรุปข้อมูลจากทุกโมดูล พร้อมส่งออกเป็น CSV" />
      <ReportView />
    </div>
  );
}
