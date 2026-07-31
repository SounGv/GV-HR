import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { LeaveView } from "@/features/leave/leave-view";

export const metadata: Metadata = { title: "การลา" };

export default async function LeavePage() {
  await requirePagePermission("leave:read");

  return (
    <div className="space-y-6">
      <PageHeader title="การลาและ OT" description="ยื่นคำขอลา ดูโควตาวันลา และอนุมัติคำขอของทีม" />
      <LeaveView />
    </div>
  );
}
