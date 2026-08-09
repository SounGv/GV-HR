"use client";

import { MobileScreen } from "./mobile-screen";
import { PayrollView } from "@/features/payroll/payroll-view";

export function MobilePayrollView() {
  return (
    <MobileScreen title="สลิปเงินเดือน" contentClassName="space-y-4 p-4">
      <PayrollView />
    </MobileScreen>
  );
}
