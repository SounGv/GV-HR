import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { RoundListView } from "@/features/appraisal-round/round-list-view";

export const metadata: Metadata = { title: "รอบประเมิน" };

export default async function AppraisalRoundsPage() {
  await requirePagePermission("campaign:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="รอบประเมิน" description="สร้างรอบ เลือกคน จับคู่ผู้ประเมิน แล้วเปิดรอบเพื่อส่งข้อความให้ผู้ประเมิน" />
      <RoundListView />
    </div>
  );
}
