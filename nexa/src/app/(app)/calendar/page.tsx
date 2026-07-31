import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/features/calendar/calendar-view";

export const metadata: Metadata = { title: "ปฏิทินองค์กร" };

export default async function CalendarPage() {
  await requirePagePermission("calendar:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ปฏิทินองค์กร"
        description="รวมวันหยุด การลาที่อนุมัติ วันอบรม และกิจกรรมองค์กรในมุมมองเดียว"
      />
      <CalendarView />
    </div>
  );
}
