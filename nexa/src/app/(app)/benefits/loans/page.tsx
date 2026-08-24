import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { LoanView } from "@/features/company-loan/loan-view";

export const metadata: Metadata = { title: "กู้เงินบริษัท" };

export default async function BenefitsLoansPage() {
  await requirePagePermission("expense:read");

  return (
    <div className="space-y-6">
      <PageHeader title="กู้เงินบริษัท" description="ยื่นกู้ ติดตามสถานะ และประวัติการกู้เงินบริษัท" />
      <LoanView />
    </div>
  );
}
