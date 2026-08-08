import type { LucideIcon } from "lucide-react";

import {

  ScanLine,

  CalendarMinus,

  Clock3,

  CalendarClock,

  Target,

  Flag,

  ClipboardCheck,

  Heart,

  Receipt,

  Wallet,

  HeartHandshake,

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



export interface MobileMenuGroup {

  title: string;

  items: MobileMenuItem[];

}



/** Employee-facing quick modules — mirrors GV One mobile design mockup. */

export const MOBILE_EMPLOYEE_GROUPS: MobileMenuGroup[] = [

  {

    title: "หมวดเวลาทำงาน",

    items: [

      { id: "checkin", label: "สแกนเข้า-ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read" },

      { id: "leave", label: "ขอลา", href: "/leave/new", icon: CalendarMinus, permission: "leave:read" },

      { id: "timeedit", label: "แก้เวลาเข้า-ออกงาน", href: "/workflows/requests/new", icon: Clock3, permission: "workflow:read" },

      { id: "shift", label: "ตารางกะ", href: "/shifts", icon: CalendarClock, permission: "shift:read" },

    ],

  },

  {

    title: "หมวดผลงานและประเมิน",

    items: [

      { id: "kpi", label: "KPI ส่วนตัว", href: "/kpi", icon: Target, permission: "kpi:read" },

      { id: "goals", label: "เป้าหมาย", href: "/coming-soon?title=เป้าหมาย", icon: Flag, permission: "kpi:read" },

      { id: "review", label: "ประเมินผล", href: "/performance", icon: ClipboardCheck, permission: "performance:read" },

      { id: "feedback", label: "ฟีดแบ็ก", href: "/coming-soon?title=ฟีดแบ็ก", icon: Heart, permission: "performance:read" },

    ],

  },

  {

    title: "หมวดเงินเดือนและสวัสดิการ",

    items: [

      { id: "payslip", label: "สลิปเงินเดือน", href: "/payroll", icon: Receipt, permission: "payroll:read" },

      { id: "expense", label: "เบิกค่าใช้จ่าย", href: "/expenses/new", icon: Wallet, permission: "expense:read" },

      { id: "benefit", label: "สวัสดิการ", href: "/coming-soon?title=สวัสดิการ", icon: HeartHandshake, permission: "payroll:read" },

      { id: "profile", label: "โปรไฟล์", href: "/profile", icon: UserCircle, permission: "dashboard:read" },

    ],

  },

];



/** HR / manager modules from mobile design mockup. */

export const MOBILE_HR_GROUPS: MobileMenuGroup[] = [

  {

    title: "หมวดบริหารพนักงาน",

    items: [

      { id: "checkin-hr", label: "สแกนเข้า-ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read" },

      { id: "menusettings", label: "ตั้งค่าเมนูของฉัน", href: "/services?view=menu-settings", icon: SlidersHorizontal, permission: "dashboard:read" },

      { id: "emplist", label: "รายชื่อพนักงาน", href: "/employees", icon: Users, permission: "employee:read" },

      { id: "addemp", label: "เพิ่มพนักงาน", href: "/employees/new", icon: UserPlus, permission: "employee:create" },

      { id: "orgchart", label: "โครงสร้างองค์กร", href: "/organization", icon: Network, permission: "employee:read" },

      { id: "access", label: "สิทธิ์การเข้าถึง", href: "/admin", icon: Shield, permission: "admin:read" },

    ],

  },

  {

    title: "หมวดอนุมัติและติดตาม",

    items: [

      { id: "approvals", label: "อนุมัติเอกสาร", href: "/workflows", icon: FileCheck, permission: "workflow:read" },

      { id: "attendanceall", label: "เข้างานทั้งบริษัท", href: "/reports?view=attendance", icon: Users, permission: "report:read" },

      { id: "onsite", label: "สิทธิ์นอกสถานที่", href: "/attendance/settings", icon: MapPin, permission: "attendance:update" },

      { id: "leaveall", label: "วันลาพนักงาน", href: "/leave?view=overview", icon: CalendarRange, permission: "leave:approve" },

    ],

  },

  {

    title: "หมวดเงินเดือนและรายงาน",

    items: [

      { id: "payrollrun", label: "ประมวลผลเงินเดือน", href: "/payroll?view=run", icon: Banknote, permission: "payroll:update" },

      { id: "kpiorg", label: "KPI องค์กร", href: "/kpi?view=org", icon: BarChart3, permission: "kpi:read" },

      { id: "export", label: "ส่งออกรายงาน", href: "/reports", icon: FileDown, permission: "report:read" },

      { id: "orgsettings", label: "ตั้งค่าองค์กร", href: "/company", icon: Settings, permission: "admin:read" },

    ],

  },

];


