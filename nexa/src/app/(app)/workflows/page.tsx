import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { WorkflowView } from "@/features/workflow/workflow-view";

export const metadata: Metadata = { title: "เวิร์กโฟลว์อนุมัติ" };

export default async function WorkflowsPage() {
  await requirePagePermission("workflow:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="เวิร์กโฟลว์อนุมัติ"
        description="ออกแบบสายอนุมัติแบบหลายขั้น ส่งคำขอ และอนุมัติตามบทบาท"
      />
      <WorkflowView />
    </div>
  );
}
