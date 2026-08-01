import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CostCenterView } from "@/features/cost-center/cost-center-view";

export const metadata: Metadata = { title: "ศูนย์ต้นทุน" };

export default async function CostCentersPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ศูนย์ต้นทุน (Cost Center)"
        description="จัดกลุ่มพนักงานตามงบประมาณ/หน่วยต้นทุน สำหรับการวิเคราะห์ค่าใช้จ่าย"
      />
      <CostCenterView />
    </div>
  );
}
