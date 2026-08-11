import type { LucideIcon } from "lucide-react";

import {

  ScanLine,

  CalendarMinus,

  Timer,

  Clock3,

  CalendarClock,

  Calendar,

  Target,

  ClipboardCheck,

  Receipt,

  Wallet,

  UserCircle,

  SlidersHorizontal,

  Users,

  UserPlus,

  Network,

  Shield,

  FileCheck,

  MapPin,

  CalendarRange,

  Banknote,

  BarChart3,

  FileDown,

  Settings,

} from "lucide-react";



export interface MobileMenuItem {

  id: string;

  label: string;

  href: string;

  icon: LucideIcon;

  permission: string;

}



export type MobileMenuTone = "primary" | "info" | "warning" | "success" | "destructive";

export interface MobileMenuGroup {

  title: string;

  /** Icon-chip color for every item in this group — gives each section its
   * own identity at a glance instead of every tile reading as one
   * indistinguishable wall of lime. Defaults to "primary" if omitted. */
  tone?: MobileMenuTone;

  items: MobileMenuItem[];

}



/** Employee-facing quick modules — mirrors GV One mobile design mockup. */

export const MOBILE_EMPLOYEE_GROUPS: MobileMenuGroup[] = [

  {

    title: "หมวดเวลาทำงาน",

    tone: "primary",

    items: [

      { id: "checkin", label: "สแกนเข้า-ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read" },

      { id: "leave", label: "ขอลา", href: "/leave/new", icon: CalendarMinus, permission: "leave:read" },

      { id: "overtime", label: "ขอ OT", href: "/overtime/new", icon: Timer, permission: "overtime:read" },

      { id: "timeedit", label: "แก้เวลาเข้า-ออกงาน", href: "/attendance/corrections/new", icon: Clock3, permission: "attendance:create" },

      { id: "shift", label: "ตารางกะ", href: "/shifts", icon: CalendarClock, permission: "shift:read" },

      { id: "calendar", label: "ปฏิทินองค์กร", href: "/calendar", icon: Calendar, permission: "calendar:read" },

    ],

  },

  {

    title: "หมวดผลงานและประเมิน",

    tone: "info",

    items: [

      { id: "kpi", label: "KPI ส่วนตัว", href: "/kpi", icon: Target, permission: "kpi:read" },

      { id: "review", label: "ประเมินผล", href: "/performance", icon: ClipboardCheck, permission: "performance:read" },

    ],

  },

  {

    title: "หมวดเงินเดือนและสวัสดิการ",

    tone: "warning",

    items: [

      { id: "payslip", label: "สลิปเงินเดือน", href: "/payroll", icon: Receipt, permission: "payroll:read" },

      { id: "expense", label: "เบิกค่าใช้จ่าย", href: "/expenses/new", icon: Wallet, permission: "expense:read" },

      { id: "profile", label: "โปรไฟล์", href: "/profile", icon: UserCircle, permission: "dashboard:read" },

    ],

  },

];



/** HR / manager modules from mobile design mockup. */

export const MOBILE_HR_GROUPS: MobileMenuGroup[] = [

  {

    title: "หมวดบริหารพนักงาน",

    tone: "success",

    items: [

      { id: "menusettings", label: "ตั้งค่าเมนูของฉัน", href: "/services?view=menu-settings", icon: SlidersHorizontal, permission: "dashboard:read" },

      { id: "emplist", label: "รายชื่อพนักงาน", href: "/employees", icon: Users, permission: "employee:read" },

      { id: "addemp", label: "เพิ่มพนักงาน", href: "/employees/new", icon: UserPlus, permission: "employee:create" },

      { id: "orgchart", label: "โครงสร้างองค์กร", href: "/organization", icon: Network, permission: "employee:read" },

      { id: "access", label: "สิทธิ์การเข้าถึง", href: "/admin", icon: Shield, permission: "admin:read" },

    ],

  },

  {

    title: "หมวดอนุมัติและติดตาม",

    tone: "destructive",

    items: [

      { id: "approvals", label: "อนุมัติเอกสาร", href: "/workflows?tab=inbox", icon: FileCheck, permission: "workflow:read" },

      { id: "attendanceall", label: "เข้างานทั้งบริษัท", href: "/reports?view=attendance", icon: Users, permission: "report:read" },

      { id: "onsite", label: "สิทธิ์นอกสถานที่", href: "/attendance/settings", icon: MapPin, permission: "attendance:update" },

      { id: "leaveall", label: "วันลาพนักงาน", href: "/leave?view=overview", icon: CalendarRange, permission: "leave:approve" },

    ],

  },

  {

    title: "หมวดเงินเดือนและรายงาน",

    tone: "warning",

    items: [

      { id: "payrollrun", label: "ประมวลผลเงินเดือน", href: "/payroll?view=run", icon: Banknote, permission: "payroll:update" },

      { id: "kpiorg", label: "KPI องค์กร", href: "/kpi?view=org", icon: BarChart3, permission: "kpi:read" },

      { id: "export", label: "ส่งออกรายงาน", href: "/reports", icon: FileDown, permission: "report:read" },

      { id: "orgsettings", label: "ตั้งค่าองค์กร", href: "/company", icon: Settings, permission: "admin:read" },

    ],

  },

];


