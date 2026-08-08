"use client";

import { LeaveView } from "@/features/leave/leave-view";
import { MobileScreen } from "./mobile-screen";

export function MobileLeaveListView() {
  return (
    <MobileScreen title="การลา" backHref="/dashboard">
      <LeaveView />
    </MobileScreen>
  );
}
