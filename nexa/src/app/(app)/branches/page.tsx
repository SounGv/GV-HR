import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { BranchView } from "@/features/branch/branch-view";

export const metadata: Metadata = { title: "สาขา" };

export default async function BranchesPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="สาขา (Branches)"
        description="จัดการสาขาขององค์กร — ที่อยู่ ผู้ติดต่อ และพื้นที่เช็คอิน"
      />
      <BranchView />
    </div>
  );
}
