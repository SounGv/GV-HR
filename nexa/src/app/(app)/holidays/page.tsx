import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { HolidaysView } from "@/features/holiday/holidays-view";

export const metadata: Metadata = { title: "วันหยุด" };

export default async function HolidaysPage() {
  await requirePagePermission("holiday:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="วันหยุดประจำปี"
        description="จัดการปฏิทินวันหยุดขององค์กร"
      />
      <HolidaysView />
    </div>
  );
}
