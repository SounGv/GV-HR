import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { MobilePerformanceView } from "@/components/mobile/mobile-performance-view";
import { PerformanceView } from "@/features/performance/performance-view";

export const metadata: Metadata = { title: "ประเมินผลงาน" };

export default async function PerformancePage() {
  await requirePagePermission("performance:read");

  return (
    <>
      <MobilePerformanceView />
      <div className="hidden space-y-6 md:block">
        <PageHeader title="ประเมินผลงาน" description="ดูผลการประเมินของคุณ และประเมินสมรรถนะของทีม" />
        <PerformanceView />
      </div>
    </>
  );
}
