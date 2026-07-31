import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftView } from "@/features/shift/shift-view";

export const metadata: Metadata = { title: "กะการทำงาน" };

export default async function ShiftsPage() {
  await requirePagePermission("shift:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="กะการทำงาน"
        description="กำหนดกะและจัดตารางเวรพนักงานรายสัปดาห์"
      />
      <ShiftView />
    </div>
  );
}
