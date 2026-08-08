"use client";

import type { ComponentType } from "react";
import {
  MobileBenefitModule,
  MobileExpenseModule,
  MobileFeedbackModule,
  MobileGoalsModule,
  MobileKpiModule,
  MobilePayslipModule,
  MobileReviewModule,
} from "@/components/mobile/modules/employee-modules";
import {
  MobileAccessModule,
  MobileAddEmpModule,
  MobileApprovalsModule,
  MobileAttendanceAllModule,
  MobileEmpListModule,
  MobileExportModule,
  MobileKpiOrgModule,
  MobileLeaveAllModule,
  MobileMenuSettingsModule,
  MobileOnsiteModule,
  MobileOrgChartModule,
  MobileOrgSettingsModule,
  MobilePayrollRunModule,
} from "@/components/mobile/modules/hr-modules";
import {
  MobileCheckinModule,
  MobileShiftModule,
  MobileTimeEditModule,
} from "@/components/mobile/modules/worktime-modules";

/** GV One mobile mockup modules — keyed by route (+ optional ?view=). */
export function resolveMobileModule(
  pathname: string,
  searchParams: URLSearchParams,
): ComponentType | null {
  const view = searchParams.get("view");
  const title = searchParams.get("title");

  if (pathname === "/coming-soon") {
    if (title === "เป้าหมาย") return MobileGoalsModule;
    if (title === "ฟีดแบ็ก") return MobileFeedbackModule;
    if (title === "สวัสดิการ") return MobileBenefitModule;
  }

  if (pathname === "/services" && view === "menu-settings") return MobileMenuSettingsModule;

  if (pathname === "/kpi") return view === "org" ? MobileKpiOrgModule : MobileKpiModule;
  if (pathname === "/payroll") return view === "run" ? MobilePayrollRunModule : MobilePayslipModule;

  if (pathname === "/reports") {
    if (view === "attendance") return MobileAttendanceAllModule;
    return MobileExportModule;
  }

  if (pathname === "/leave" && view === "overview") return MobileLeaveAllModule;

  const exact: Record<string, ComponentType> = {
    "/attendance": MobileCheckinModule,
    "/workflows/requests/new": MobileTimeEditModule,
    "/shifts": MobileShiftModule,
    "/performance": MobileReviewModule,
    "/expenses/new": MobileExpenseModule,
    "/employees": MobileEmpListModule,
    "/employees/new": MobileAddEmpModule,
    "/organization": MobileOrgChartModule,
    "/admin": MobileAccessModule,
    "/workflows": MobileApprovalsModule,
    "/attendance/settings": MobileOnsiteModule,
    "/company": MobileOrgSettingsModule,
  };

  return exact[pathname] ?? null;
}
