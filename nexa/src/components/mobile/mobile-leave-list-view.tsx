"use client";

import { MobileScreen } from "@/components/mobile/mobile-screen";
import { LeaveView } from "@/features/leave/leave-view";

export function MobileLeaveListView() {
  return (
    <MobileScreen title="การลา" contentClassName="space-y-4 p-4">
      <LeaveView />
    </MobileScreen>
  );
}
