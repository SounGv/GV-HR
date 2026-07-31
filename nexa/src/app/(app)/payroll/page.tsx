import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { PayrollView } from "@/features/payroll/payroll-view";

export const metadata: Metadata = { title: "เงินเดือนและสลิป" };

export default async function PayrollPage() {
  await requirePagePermission("payroll:read");

  return (
    <div className="space-y-6">
      <PageHeader title="เงินเดือนและสลิป" description="ดูสลิปเงินเดือนของคุณ และจัดการรอบการจ่ายเงินเดือน" />
      <PayrollView />
    </div>
  );
}
