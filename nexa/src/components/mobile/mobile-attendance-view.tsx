"use client";

import { MobileScreen } from "./mobile-screen";
import { ClockCard } from "@/features/attendance/clock-card";
import { AttendanceQuickActions } from "@/features/attendance/quick-actions";
import { AttendanceHistory } from "@/features/attendance/attendance-history";
import { RecognitionTiles } from "@/features/recognition/recognition-tiles";

export function MobileAttendanceView() {
  return (
    <MobileScreen title="เวลาเข้า-ออกงาน" contentClassName="space-y-4 p-4">
      <ClockCard />
      <RecognitionTiles />
      <AttendanceQuickActions />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการลงเวลา (30 วันล่าสุด)</h2>
        <AttendanceHistory />
      </div>
    </MobileScreen>
  );
}
