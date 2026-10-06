import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { OverviewView } from "@/features/appraisal-round/overview-view";

export const metadata: Metadata = { title: "ภาพรวมการประเมิน" };

export default async function AppraisalHomePage() {
  await requirePagePermission("campaign:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="ภาพรวมการประเมิน" description="รอบที่เปิดอยู่ และความคืบหน้ารายแผนก" />
      <OverviewView />
    </div>
  );
}
