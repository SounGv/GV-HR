import type { LucideIcon } from "lucide-react";
import {
  ScanLine,
  FilePlus2,
  Timer,
  Clock3,
  CalendarClock,
  CalendarDays,
  Target,
  ClipboardCheck,
  CalendarPlus,
  Wallet,
  HeartPulse,
  SlidersHorizontal,
  UsersRound,
  UserPlus,
  Network,
  Shield,
  MapPin,
  CalendarRange,
  BarChart3,
  Download,
  Settings2,
} from "lucide-react";

/** Per-category icon tone (2026-08-25 icon/logo spec) — items without a
 * `tone` fall back to the shared green icon-chip (bg-icon-chip-bg /
 * text-icon-chip-fg), which is itself one of these categories' colors. */
export type MenuIconTone = "overtime" | "calendar" | "violet" | "profile";

export interface MobileMenuItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  tone?: MenuIconTone;
}

export type MobileMenuTone = "primary" | "info" | "warning" | "success" | "destructive";

export interface MobileMenuGroup {
  title: string;
  /** Icon-chip color for every item in this group. Redesign spec: every
   * icon uses the same monochrome-green chip (see MobileMenuTileGrid's
   * TONE_CLASSES) — kept as a field for now so a future exception is a
   * one-line change, not a type change, but it no longer varies visually. */
  tone?: MobileMenuTone;
  items: MobileMenuItem[];
}

/**
 * Personal quick modules, grouped to match the redesign's category names
 * (เวลาทำงาน / การลาและคำขอ / ประเมินและพัฒนา) — everyone sees these.
 */
export const MOBILE_EMPLOYEE_GROUPS: MobileMenuGroup[] = [
  {
    title: "เวลาทำงาน",
    tone: "primary",
    items: [
      { id: "checkin", label: "เข้างาน / ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read" },
      { id: "timeedit", label: "แก้เวลาเข้า-ออกงาน", href: "/attendance/corrections/new", icon: Clock3, permission: "attendance:create" },
      { id: "shift", label: "ตารางกะ", href: "/shifts", icon: CalendarClock, permission: "shift:read" },
      { id: "calendar", label: "ปฏิทินองค์กร", href: "/calendar", icon: CalendarDays, permission: "calendar:read", tone: "calendar" },
    ],
  },
  {
    title: "การลาและคำขอ",
    tone: "primary",
    items: [
      { id: "leave", label: "ขอลา", href: "/leave/new", icon: FilePlus2, permission: "leave:read" },
      { id: "overtime", label: "ขอ OT", href: "/overtime/new", icon: Timer, permission: "overtime:read", tone: "overtime" },
      { id: "expense", label: "เบิกค่าใช้จ่าย", href: "/expenses/new", icon: Wallet, permission: "expense:read" },
      { id: "benefits", label: "สวัสดิการ", href: "/benefits", icon: HeartPulse, permission: "expense:read", tone: "violet" },
    ],
  },
  {
    title: "ประเมินและพัฒนา",
    tone: "primary",
    items: [
      { id: "kpi", label: "KPI ส่วนตัว", href: "/kpi", icon: Target, permission: "kpi:read" },
      { id: "review", label: "ประเมินผล", href: "/performance", icon: ClipboardCheck, permission: "performance:read", tone: "violet" },
      { id: "meeting", label: "นัดประชุม", href: "/meetings", icon: CalendarPlus, permission: "meeting:read" },
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
    tone: "primary",
    items: [
      { id: "emplist", label: "รายชื่อพนักงาน", href: "/employees", icon: UsersRound, permission: "employee:read" },
      { id: "addemp", label: "เพิ่มพนักงาน", href: "/employees/new", icon: UserPlus, permission: "employee:create" },
      { id: "orgchart", label: "โครงสร้างองค์กร", href: "/organization", icon: Network, permission: "employee:read" },
      { id: "access", label: "สิทธิ์การเข้าถึง", href: "/admin", icon: Shield, permission: "admin:read" },
    ],
  },
  {
    title: "รายงานและสื่อสาร",
    tone: "primary",
    items: [
      { id: "approvals", label: "อนุมัติเอกสาร", href: "/workflows?tab=inbox", icon: ClipboardCheck, permission: "workflow:read" },
      { id: "attendanceall", label: "เข้างานทั้งบริษัท", href: "/reports?view=attendance", icon: BarChart3, permission: "report:read" },
      { id: "leaveall", label: "วันลาพนักงาน", href: "/leave?view=overview", icon: CalendarRange, permission: "leave:approve" },
      { id: "kpiorg", label: "KPI องค์กร", href: "/kpi?view=org", icon: BarChart3, permission: "kpi:read" },
    ],
  },
  {
    title: "ข้อมูลระบบ",
    tone: "primary",
    items: [
      { id: "export", label: "ส่งออกรายงาน", href: "/reports", icon: Download, permission: "report:read" },
      { id: "menusettings", label: "ตั้งค่าเมนูของฉัน", href: "/services?view=menu-settings", icon: SlidersHorizontal, permission: "dashboard:read" },
    ],
  },
  {
    title: "ระบบ",
    tone: "primary",
    items: [
      { id: "orgsettings", label: "ตั้งค่าองค์กร", href: "/company", icon: Settings2, permission: "admin:read" },
      { id: "onsite", label: "สิทธิ์นอกสถานที่", href: "/attendance/settings", icon: MapPin, permission: "attendance:update" },
    ],
  },
];
