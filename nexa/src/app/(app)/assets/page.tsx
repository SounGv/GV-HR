import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AssetsView } from "@/features/asset/assets-view";

export const metadata: Metadata = { title: "เอกสารและทรัพย์สิน" };

export default async function AssetsPage() {
  await requirePagePermission("asset:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ทรัพย์สินและครุภัณฑ์" description="ทะเบียนทรัพย์สินบริษัท และการเบิก/คืนให้พนักงาน" />
      <AssetsView />
    </div>
  );
}
