import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NoEmployeeState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/page-header";
import { MobileAttendanceView } from "@/components/mobile/mobile-attendance-view";
import { MobileScreen } from "@/components/mobile/mobile-screen";
import { ClockCard } from "@/features/attendance/clock-card";
import { AttendanceQuickActions } from "@/features/attendance/quick-actions";
import { AttendanceHistory } from "@/features/attendance/attendance-history";
import { RecognitionTiles } from "@/features/recognition/recognition-tiles";

export const metadata: Metadata = { title: "เวลาเข้า-ออกงาน" };

export default async function AttendancePage() {
  await requirePagePermission("attendance:read");
  // An account with no employee record has no clock-in of its own: say so, rather than showing two failed loads.
  const user = await getCurrentUser();
  if (!user?.employee) {
    const state = (
      <NoEmployeeState description="จึงไม่มีการลงเวลาของตัวเอง ดูการเข้างานของทุกคนได้ที่หน้าหลักและเมนูรายงาน ถ้าต้องลงเวลา ให้ HR ผูกบัญชีกับข้อมูลพนักงานก่อน" />
    );
    // This path has its own phone layout, so the phone needs its own header here too, or the message is a dead end with no way back.
    return (
      <>
        <MobileScreen title="เวลาเข้า-ออกงาน" backHref="/dashboard" contentClassName="p-4">
          {state}
        </MobileScreen>
        <div className="hidden space-y-6 md:block">
          <PageHeader title="ลงเวลาทำงาน" description="ลงเวลาเข้า-ออกงาน และดูประวัติเวลาทำงานของคุณ" />
          {state}
        </div>
      </>
    );
  }

  return (
    <>
      <MobileAttendanceView />
      <div className="hidden space-y-6 md:block">
        <PageHeader
          title="ลงเวลาทำงาน"
          description="ลงเวลาเข้า-ออกงาน และดูประวัติเวลาทำงานของคุณ"
        />
        <ClockCard />
        <RecognitionTiles />
        <AttendanceQuickActions />
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">ประวัติการลงเวลา (30 วันล่าสุด)</h2>
          <AttendanceHistory />
        </div>
      </div>
    </>
  );
}
