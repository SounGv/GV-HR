import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { DetailReportView } from "@/features/appraisal-round/detail-report-view";

export const metadata: Metadata = { title: "รายงานประเมินละเอียด" };

export default async function AppraisalDetailReportPage() {
  await requirePagePermission("campaign:update");
  return (
    <div className="space-y-4">
      <PageHeader title="รายงานประเมินละเอียด" description="ดูว่าใครประเมินใคร ให้คะแนนเท่าไร เขียนความเห็นอะไร พร้อมกราฟเทียบรายคน รายทีม และข้ามรอบ" />
      <DetailReportView />
    </div>
  );
}
