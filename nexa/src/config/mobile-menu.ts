import type { ComponentType, SVGProps } from "react";
import {
  CheckInIcon,
  TimeEditIcon,
  ShiftIcon,
  ExpenseIcon,
  BenefitsIcon,
  KpiIcon,
  MeetingIcon,
  AddPersonIcon,
  OrgChartIcon,
  AccessIcon,
  AttendanceReportIcon,
  LeaveOverviewIcon,
  KpiOrgIcon,
  ExportIcon,
  MenuSettingsIcon,
  OrgSettingsIcon,
  OnsiteIcon,
} from "@/components/shared/menu-icons";
import {
  LeaveIcon,
  OvertimeIcon,
  CalendarIcon,
  ClipboardIcon,
  StarIllustrationIcon,
  PeopleIcon,
  DailyWorkerIcon,
} from "@/components/shared/illustrated-icons";

/** Every menu item icon is fixed, full-color illustrated artwork (name-
 * matched, see gv-hr-menu-icons.md) — not a theme-recolored chip, so it's a
 * plain component that takes a pixel `size`, not a lucide-style icon whose
 * color comes from CSS. */
export type MenuIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export interface MobileMenuItem {
  id: string;
  label: string;
  href: string;
  icon: MenuIcon;
  permission: string;
}

export interface MobileMenuGroup {
  title: string;
  /** Category-header accent bar color, matching the same group's chip
   * color in the desktop sidebar (see NAV_GROUPS in navigation.ts). */
  accent: string;
  items: MobileMenuItem[];
}

/**
 * Personal quick modules, grouped to match the redesign's category names
 * (เวลาทำงาน / การลาและคำขอ / ประเมินและพัฒนา) — everyone sees these.
 */
export const MOBILE_EMPLOYEE_GROUPS: MobileMenuGroup[] = [
  {
    title: "เวลาทำงาน",
    accent: "#3B82F6",
    items: [
      { id: "checkin", label: "เข้างาน / ออกงาน", href: "/attendance", icon: CheckInIcon, permission: "attendance:read" },
      { id: "timeedit", label: "แก้เวลาเข้า-ออกงาน", href: "/attendance/corrections/new", icon: TimeEditIcon, permission: "attendance:create" },
      { id: "shift", label: "ตารางกะ", href: "/shifts", icon: ShiftIcon, permission: "shift:read" },
      { id: "calendar", label: "ปฏิทินองค์กร", href: "/calendar", icon: CalendarIcon, permission: "calendar:read" },
    ],
  },
  {
    title: "การลาและคำขอ",
    accent: "#22A55B",
    items: [
      { id: "leave", label: "ขอลา", href: "/leave/new", icon: LeaveIcon, permission: "leave:read" },
      { id: "overtime", label: "ขอ OT", href: "/overtime/new", icon: OvertimeIcon, permission: "overtime:read" },
      { id: "expense", label: "เบิกค่าใช้จ่าย", href: "/expenses/new", icon: ExpenseIcon, permission: "expense:read" },
      { id: "benefits", label: "สวัสดิการ", href: "/benefits", icon: BenefitsIcon, permission: "expense:read" },
    ],
  },
  {
    title: "ประเมินและพัฒนา",
    accent: "#F5A524",
    items: [
      { id: "kpi", label: "KPI ส่วนตัว", href: "/kpi", icon: KpiIcon, permission: "kpi:read" },
      { id: "review", label: "ประเมินผล", href: "/performance", icon: StarIllustrationIcon, permission: "performance:read" },
      { id: "meeting", label: "นัดประชุม", href: "/meetings", icon: MeetingIcon, permission: "meeting:read" },
    ],
  },
];

/**
 * Manager/HR add-on modules, grouped to match the redesign's category names
 * (พนักงานและองค์กร / รายงานและสื่อสาร / ข้อมูลระบบ / ระบบ) — shown below a
 * divider, only for accounts with the relevant permissions.
 */
export const MOBILE_HR_GROUPS: MobileMenuGroup[] = [
  {
    title: "พนักงานและองค์กร",
    accent: "#6366F1",
    items: [
      { id: "emplist", label: "รายชื่อพนักงาน", href: "/employees", icon: PeopleIcon, permission: "employee:read" },
      { id: "dailyemp", label: "พนักงานรายวัน", href: "/employees?employmentType=DAILY_WORKER", icon: DailyWorkerIcon, permission: "employee:read" },
      { id: "addemp", label: "เพิ่มพนักงาน", href: "/employees/new", icon: AddPersonIcon, permission: "employee:create" },
      { id: "orgchart", label: "โครงสร้างองค์กร", href: "/organization", icon: OrgChartIcon, permission: "employee:read" },
      { id: "access", label: "สิทธิ์การเข้าถึง", href: "/admin", icon: AccessIcon, permission: "admin:read" },
    ],
  },
  {
    title: "รายงานและสื่อสาร",
    accent: "#EC4899",
    items: [
      { id: "approvals", label: "อนุมัติเอกสาร", href: "/workflows?tab=inbox", icon: ClipboardIcon, permission: "workflow:read" },
      { id: "attendanceall", label: "เข้างานทั้งบริษัท", href: "/reports?view=attendance", icon: AttendanceReportIcon, permission: "report:read" },
      { id: "leaveall", label: "วันลาพนักงาน", href: "/leave?view=overview", icon: LeaveOverviewIcon, permission: "leave:approve" },
      { id: "kpiorg", label: "KPI องค์กร", href: "/kpi?view=org", icon: KpiOrgIcon, permission: "kpi:read" },
    ],
  },
  {
    title: "ข้อมูลระบบ",
    accent: "#8A9199",
    items: [
      { id: "export", label: "ส่งออกรายงาน", href: "/reports", icon: ExportIcon, permission: "report:read" },
      { id: "menusettings", label: "ตั้งค่าเมนูของฉัน", href: "/services?view=menu-settings", icon: MenuSettingsIcon, permission: "dashboard:read" },
    ],
  },
  {
    title: "ระบบ",
    accent: "#64748B",
    items: [
      { id: "orgsettings", label: "ตั้งค่าองค์กร", href: "/company", icon: OrgSettingsIcon, permission: "admin:read" },
      { id: "onsite", label: "สิทธิ์นอกสถานที่", href: "/attendance/settings", icon: OnsiteIcon, permission: "attendance:update" },
    ],
  },
];
