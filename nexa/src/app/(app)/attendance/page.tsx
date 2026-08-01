import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ClockCard } from "@/features/attendance/clock-card";
import { AttendanceHistory } from "@/features/attendance/attendance-history";

export const metadata: Metadata = { title: "เวลาเข้า-ออกงาน" };

export default async function AttendancePage() {
  await requirePagePermission("attendance:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Attendance"
        description="เช็คอิน/เช็คเอาท์อัจฉริยะด้วย GPS + Geofence และดูประวัติการลงเวลาของคุณ"
      />
      <ClockCard />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการลงเวลา (30 วันล่าสุด)</h2>
        <AttendanceHistory />
      </div>
    </div>
  );
}
