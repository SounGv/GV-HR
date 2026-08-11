"use client";

import { MobileScreen } from "./mobile-screen";
import { MobileCheckinCard } from "./mobile-checkin-card";
import { MobileAttendanceHistory } from "./mobile-attendance-history";
import { AttendanceQuickActions } from "@/features/attendance/quick-actions";
import { RecognitionTiles } from "@/features/recognition/recognition-tiles";

export function MobileAttendanceView() {
  return (
    <MobileScreen title="เวลาเข้า-ออกงาน" contentClassName="space-y-4 p-4">
      <MobileCheckinCard />
      <RecognitionTiles />
      <AttendanceQuickActions />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการลงเวลา (30 วันล่าสุด)</h2>
        <MobileAttendanceHistory />
      </div>
    </MobileScreen>
  );
}
