import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { RecruitmentView } from "@/features/recruitment/recruitment-view";

export const metadata: Metadata = { title: "สรรหาพนักงาน" };

export default async function RecruitmentPage() {
  await requirePagePermission("recruitment:read");

  return (
    <div className="space-y-6">
      <PageHeader title="สรรหาพนักงาน" description="ประกาศตำแหน่งงานและติดตามผู้สมัครในแต่ละขั้นตอน" />
      <RecruitmentView />
    </div>
  );
}
