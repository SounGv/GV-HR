import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { BenefitsHubView } from "@/features/benefits/benefits-hub-view";

export const metadata: Metadata = { title: "สวัสดิการ" };

export default async function BenefitsPage() {
  await requirePagePermission("expense:read");

  return (
    <div className="space-y-6">
      <PageHeader title="สวัสดิการ" description="ค่ารักษาพยาบาลและกู้เงินบริษัท" />
      <BenefitsHubView />
    </div>
  );
}
