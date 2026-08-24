import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { BenefitsHistoryView } from "@/features/benefits/history-view";

export const metadata: Metadata = { title: "ประวัติสวัสดิการของฉัน" };

export default async function BenefitsHistoryPage() {
  await requirePagePermission("expense:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ประวัติสวัสดิการของฉัน" description="รวมรายการเบิกค่ารักษาพยาบาลและกู้เงินบริษัททั้งหมดของคุณ" />
      <BenefitsHistoryView />
    </div>
  );
}
