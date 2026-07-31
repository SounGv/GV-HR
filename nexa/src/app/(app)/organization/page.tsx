import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { OrganizationView } from "@/features/organization/organization-view";

export const metadata: Metadata = { title: "โครงสร้างองค์กร" };

export default async function OrganizationPage() {
  await requirePagePermission("employee:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="โครงสร้างองค์กร"
        description="จัดการฝ่าย แผนกย่อย ตำแหน่ง และระดับพนักงานขององค์กร"
      />
      <OrganizationView />
    </div>
  );
}
