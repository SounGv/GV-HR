import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { MedicalClaimsView } from "@/features/expense/medical-claims-view";

export const metadata: Metadata = { title: "ค่ารักษาพยาบาล" };

export default async function BenefitsMedicalPage() {
  await requirePagePermission("expense:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ค่ารักษาพยาบาล" description="ยื่นเบิก ติดตามวงเงิน และประวัติการเบิกค่ารักษาพยาบาล" />
      <MedicalClaimsView />
    </div>
  );
}
