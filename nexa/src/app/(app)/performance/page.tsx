import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { PerformanceView } from "@/features/performance/performance-view";

export const metadata: Metadata = { title: "ประเมินผลงาน" };

export default async function PerformancePage() {
  await requirePagePermission("performance:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ประเมินผลงาน" description="ดูผลการประเมินของคุณ และประเมินสมรรถนะของทีม" />
      <PerformanceView />
    </div>
  );
}
