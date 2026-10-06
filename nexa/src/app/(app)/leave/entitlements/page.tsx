import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { EntitlementsView } from "@/features/leave/entitlements-view";

export const metadata: Metadata = { title: "สิทธิ์ลารายคน" };

/** HR only. */
export default async function LeaveEntitlementsPage() {
  await requirePagePermission("employee:update");
  return (
    <div className="space-y-6">
      <PageHeader title="สิทธิ์ลารายคน" description="ดูและแก้สิทธิ์ลาป่วย ลากิจ ลาพักร้อนของแต่ละคนในแต่ละปี" />
      <EntitlementsView />
    </div>
  );
}
