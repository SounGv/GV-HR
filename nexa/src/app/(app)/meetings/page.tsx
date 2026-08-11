import type { Metadata } from "next";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { MeetingView } from "@/features/meeting/meeting-view";

export const metadata: Metadata = { title: "นัดประชุม" };

export default async function MeetingsPage() {
  await requirePagePermission("meeting:read");

  return (
    <div className="space-y-6">
      <PageHeader title="นัดประชุม" description="ดูคำเชิญเข้าร่วมประชุม ตอบรับ/ปฏิเสธ หรือนัดประชุมใหม่" />
      <MeetingView />
    </div>
  );
}
