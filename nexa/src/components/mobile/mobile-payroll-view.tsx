"use client";

import { MobileScreen } from "./mobile-screen";
import { MobileMyPayslips } from "@/features/payroll/mobile-payslips-view";

export function MobilePayrollView() {
  return (
    <MobileScreen title="สลิปเงินเดือน" contentClassName="space-y-4 p-4">
      <MobileMyPayslips />
    </MobileScreen>
  );
}
