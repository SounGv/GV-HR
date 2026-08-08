import type { ComponentType } from "react";
import type { MobileRouteKey } from "./mobile-routes";
import {
  MobileAccessModule,
  MobileAddEmpModule,
  MobileApprovalsModule,
  MobileAttendanceModule,
  MobileBenefitModule,
  MobileEmpListModule,
  MobileExpenseModule,
  MobileExportModule,
  MobileFeedbackModule,
  MobileGoalsModule,
  MobileKpiModule,
  MobileKpiOrgModule,
  MobileLeaveAllModule,
  MobileMenuSettingsModule,
  MobileOnsiteModule,
  MobileOrgChartModule,
  MobileOrgSettingsModule,
  MobilePayrollRunModule,
  MobilePayslipModule,
  MobileReviewModule,
  MobileShiftModule,
  MobileTimeEditModule,
} from "@/components/mobile/modules/feature-modules";
import { MobileHomeView } from "@/components/mobile/mobile-home-view";
import { MobileLeaveForm } from "@/components/mobile/mobile-leave-form";
import { MobileLeaveListView } from "@/components/mobile/mobile-leave-list-view";
import { MobileProfilePage } from "@/components/mobile/mobile-profile-page";

export type MobileModuleComponent = ComponentType<Record<string, never>>;

const REGISTRY: Partial<Record<MobileRouteKey, MobileModuleComponent>> = {
  home: MobileHomeView,
  attendance: MobileAttendanceModule,
  leave: MobileLeaveListView,
  "leave-new": MobileLeaveForm,
  profile: MobileProfilePage,
  "time-edit": MobileTimeEditModule,
  shift: MobileShiftModule,
  kpi: MobileKpiModule,
  review: MobileReviewModule,
  payslip: MobilePayslipModule,
  expense: MobileExpenseModule,
  employees: MobileEmpListModule,
  "add-employee": MobileAddEmpModule,
  "org-chart": MobileOrgChartModule,
  access: MobileAccessModule,
  approvals: MobileApprovalsModule,
  onsite: MobileOnsiteModule,
  "leave-all": MobileLeaveAllModule,
  "payroll-run": MobilePayrollRunModule,
  "kpi-org": MobileKpiOrgModule,
  export: MobileExportModule,
  "org-settings": MobileOrgSettingsModule,
  goals: MobileGoalsModule,
  feedback: MobileFeedbackModule,
  benefits: MobileBenefitModule,
  "menu-settings": MobileMenuSettingsModule,
};

export function resolveMobileModule(key: MobileRouteKey): MobileModuleComponent | null {
  return REGISTRY[key] ?? null;
}
