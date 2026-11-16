import type { ComponentType, SVGProps } from "react";
import {
  RBuilding, RCalendarClock, RCalendarDays, RCalendarRange, RClipboardPen, RClock, RChart, RDownload, RFileCheck, RGauge, RGrid,
  RHandHeart, RListChecks, RMapPin, RNetwork, RPalm, RReceipt, RScan, RSettings, RShield, RSprout, RTarget, RTimer, RUser, RUserPlus, RUsersRound, RVideo,
} from "@/components/shared/real-icons";

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
      { id: "checkin", label: "เข้างาน / ออกงาน", href: "/attendance", icon: RScan, permission: "attendance:read" },
      { id: "timeedit", label: "แก้เวลาเข้า-ออกงาน", href: "/attendance/corrections/new", icon: RClock, permission: "attendance:create" },
      { id: "shift", label: "ตารางกะ", href: "/shifts", icon: RCalendarClock, permission: "shift:read" },
      { id: "calendar", label: "ปฏิทินองค์กร", href: "/calendar", icon: RCalendarDays, permission: "calendar:read" },
    ],
  },
  {
    title: "การลาและคำขอ",
    accent: "#22A55B",
    items: [
      { id: "leave", label: "ขอลา", href: "/leave/new", icon: RPalm, permission: "leave:read" },
      { id: "overtime", label: "ขอ OT", href: "/overtime/new", icon: RTimer, permission: "overtime:read" },
      { id: "expense", label: "เบิกค่าใช้จ่าย", href: "/expenses/new", icon: RReceipt, permission: "expense:read" },
      { id: "benefits", label: "สวัสดิการ", href: "/benefits", icon: RHandHeart, permission: "expense:read" },
    ],
  },
  {
    title: "ประเมินและพัฒนา",
    accent: "#F5A524",
    items: [
      { id: "kpi", label: "KPI ส่วนตัว", href: "/kpi", icon: RTarget, permission: "kpi:read" },
      { id: "appraisal-tasks", label: "งานประเมินของฉัน", href: "/appraisal/tasks", icon: RClipboardPen, permission: "notification:read" },
      { id: "appraisal-results", label: "ผลประเมินของฉัน", href: "/appraisal/my-results", icon: RChart, permission: "notification:read" },
      { id: "review", label: "ประวัติและแผนพัฒนา", href: "/performance", icon: RSprout, permission: "performance:read" },
      { id: "meeting", label: "นัดประชุม", href: "/meetings", icon: RVideo, permission: "meeting:read" },
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
      { id: "emplist", label: "รายชื่อพนักงาน", href: "/employees", icon: RUsersRound, permission: "employee:read" },
      { id: "dailyemp", label: "พนักงานรายวัน", href: "/employees?employmentType=DAILY_WORKER", icon: RUser, permission: "employee:read" },
      { id: "addemp", label: "เพิ่มพนักงาน", href: "/employees/new", icon: RUserPlus, permission: "employee:create" },
      { id: "orgchart", label: "โครงสร้างองค์กร", href: "/organization", icon: RNetwork, permission: "employee:read" },
      { id: "appraisal-rounds", label: "รอบประเมิน", href: "/appraisal/rounds", icon: RListChecks, permission: "campaign:manage" },
      { id: "access", label: "สิทธิ์การเข้าถึง", href: "/admin", icon: RShield, permission: "admin:read" },
    ],
  },
  {
    title: "รายงานและสื่อสาร",
    accent: "#EC4899",
    items: [
      { id: "approvals", label: "อนุมัติเอกสาร", href: "/workflows?tab=inbox", icon: RFileCheck, permission: "workflow:read" },
      { id: "attendanceall", label: "เข้างานทั้งบริษัท", href: "/reports?view=attendance", icon: RBuilding, permission: "report:read" },
      { id: "leaveall", label: "วันลาพนักงาน", href: "/leave?view=overview", icon: RCalendarRange, permission: "leave:approve" },
      { id: "kpiorg", label: "KPI องค์กร", href: "/kpi?view=org", icon: RGauge, permission: "kpi:read" },
    ],
  },
  {
    title: "ข้อมูลระบบ",
    accent: "#8A9199",
    items: [
      { id: "export", label: "ส่งออกรายงาน", href: "/reports", icon: RDownload, permission: "report:read" },
      { id: "menusettings", label: "ตั้งค่าเมนูของฉัน", href: "/services?view=menu-settings", icon: RGrid, permission: "dashboard:read" },
    ],
  },
  {
    title: "ระบบ",
    accent: "#64748B",
    items: [
      { id: "orgsettings", label: "ตั้งค่าองค์กร", href: "/company", icon: RSettings, permission: "admin:read" },
      { id: "onsite", label: "สิทธิ์นอกสถานที่", href: "/attendance/settings", icon: RMapPin, permission: "attendance:update" },
    ],
  },
];
