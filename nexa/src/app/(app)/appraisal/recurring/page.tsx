import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { RecurrenceView } from "@/features/appraisal-round/recurrence-view";

export const metadata: Metadata = { title: "รอบอัตโนมัติ" };

export default async function AppraisalRecurringPage() {
  await requirePagePermission("campaign:update");
  return (
    <div className="space-y-6">
      <PageHeader title="รอบอัตโนมัติ" description="ตั้งครั้งเดียว ระบบสร้างรอบประเมินเป็นฉบับร่างให้ทุกเดือน ไตรมาส หรือปี" />
      <RecurrenceView />
    </div>
  );
}
