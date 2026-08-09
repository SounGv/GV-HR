import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { MobilePayrollView } from "@/components/mobile/mobile-payroll-view";
import { PayrollView } from "@/features/payroll/payroll-view";

export const metadata: Metadata = { title: "เงินเดือนและสลิป" };

export default async function PayrollPage() {
  await requirePagePermission("payroll:read");

  return (
    <>
      <MobilePayrollView />
      <div className="hidden space-y-6 md:block">
        <PageHeader title="เงินเดือนและสลิป" description="ดูสลิปเงินเดือนของคุณ และจัดการรอบการจ่ายเงินเดือน" />
        <PayrollView />
      </div>
    </>
  );
}
