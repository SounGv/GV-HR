import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { OvertimeView } from "@/features/overtime/overtime-view";

export const metadata: Metadata = { title: "ล่วงเวลา (OT)" };

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requirePagePermission("overtime:read");
  const { view } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title="ทำงานล่วงเวลา (OT)" description="ยื่นคำขอ OT และอนุมัติคำขอของทีม" />
      <OvertimeView defaultTab={view === "overview" ? "approvals" : "me"} />
    </div>
  );
}
