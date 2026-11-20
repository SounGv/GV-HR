import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/shared/page-header";
import { MobilePerformanceView } from "@/components/mobile/mobile-performance-view";
import { PerformanceView } from "@/features/performance/performance-view";

export const metadata: Metadata = { title: "ประเมินผลงาน" };

export default async function PerformancePage() {
  await requirePagePermission("performance:read");
  // The old review pages read the signed-in person's own record; an account with no employee (the admin) would only see error panels, so it goes to the evaluation system.
  const user = await getCurrentUser();
  if (user && !user.employee) redirect("/appraisal");

  return (
    <>
      <MobilePerformanceView />
      <div className="hidden space-y-6 md:block">
        <PageHeader title="ประเมินผลงาน" description="ดูผลประเมินของคุณ และประเมินสมรรถนะของทีม" />
        <PerformanceView />
      </div>
    </>
  );
}
