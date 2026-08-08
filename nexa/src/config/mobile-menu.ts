import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  GitBranch,
  GraduationCap,
  LayoutGrid,
  MapPinned,
  Megaphone,
  Network,
  ReceiptText,
  Settings,
  Shield,
  Sparkles,
  Target,
  Timer,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export interface MobileMenuItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

export interface MobileMenuGroup {
  id: string;
  label: string;
  items: MobileMenuItem[];
}

/** Employee-facing quick-access tiles (mobile home — แท็บพนักงาน). */
export const MOBILE_EMPLOYEE_GROUPS: MobileMenuGroup[] = [
  {
    id: "time",
    label: "เวลาและการลา",
    items: [
      { id: "attendance", label: "เช็คอิน", href: "/attendance", icon: Clock, permission: "attendance:read" },
      { id: "leave", label: "การลา", href: "/leave", icon: CalendarDays, permission: "leave:read" },
      { id: "leave-new", label: "ขอลา", href: "/leave/new", icon: CalendarDays, permission: "leave:create" },
      { id: "time-edit", label: "แก้ไขเวลา", href: "/services?view=time-edit", icon: Timer, permission: "workflow:create" },
      { id: "shift", label: "กะงาน", href: "/services?view=shift", icon: CalendarRange, permission: "shift:read" },
    ],
  },
  {
    id: "pay",
    label: "เงินและสวัสดิการ",
    items: [
      { id: "payslip", label: "สลิปเงินเดือน", href: "/services?view=payslip", icon: Wallet, permission: "payroll:read" },
      { id: "expense", label: "เบิกจ่าย", href: "/services?view=expense", icon: ReceiptText, permission: "expense:create" },
      { id: "benefits", label: "สวัสดิการ", href: "/services?view=benefits", icon: Sparkles, permission: "payroll:read" },
    ],
  },
  {
    id: "growth",
    label: "พัฒนาตนเอง",
    items: [
      { id: "kpi", label: "KPI", href: "/services?view=kpi", icon: Target, permission: "kpi:read" },
      { id: "review", label: "ประเมินผล", href: "/services?view=review", icon: ClipboardCheck, permission: "performance:read" },
      { id: "goals", label: "เป้าหมาย", href: "/services?view=goals", icon: Target, permission: "kpi:read" },
      { id: "feedback", label: "Feedback 360", href: "/services?view=feedback", icon: Megaphone, permission: "performance:read" },
      { id: "training", label: "อบรม", href: "/training", icon: GraduationCap, permission: "training:read" },
    ],
  },
  {
    id: "general",
    label: "ทั่วไป",
    items: [
      { id: "calendar", label: "ปฏิทิน", href: "/calendar", icon: CalendarRange, permission: "calendar:read" },
      { id: "announcements", label: "ประกาศ", href: "/announcements", icon: Megaphone, permission: "announcement:read" },
      { id: "approvals", label: "คำขอของฉัน", href: "/services?view=approvals", icon: GitBranch, permission: "workflow:read" },
    ],
  },
];

/** HR / admin quick-access tiles (mobile home — แท็บ HR). */
export const MOBILE_HR_GROUPS: MobileMenuGroup[] = [
  {
    id: "people",
    label: "บุคลากร",
    items: [
      { id: "employees", label: "รายชื่อพนักงาน", href: "/services?view=employees", icon: Users, permission: "employee:read" },
      { id: "add-employee", label: "เพิ่มพนักงาน", href: "/services?view=add-employee", icon: UserPlus, permission: "employee:create" },
      { id: "org-chart", label: "แผนผังองค์กร", href: "/services?view=org-chart", icon: Network, permission: "employee:read" },
      { id: "import", label: "นำเข้าพนักงาน", href: "/employees/import", icon: Upload, permission: "employee:create" },
    ],
  },
  {
    id: "payroll-hr",
    label: "เงินเดือน",
    items: [
      { id: "payroll-run", label: "รันเงินเดือน", href: "/services?view=payroll-run", icon: Wallet, permission: "payroll:create" },
      { id: "leave-all", label: "อนุมัติการลา", href: "/leave", icon: CalendarDays, permission: "leave:approve" },
      { id: "export", label: "ส่งออกรายงาน", href: "/services?view=export", icon: BarChart3, permission: "report:read" },
    ],
  },
  {
    id: "org",
    label: "องค์กร",
    items: [
      { id: "org-settings", label: "ข้อมูลบริษัท", href: "/services?view=org-settings", icon: Building2, permission: "admin:read" },
      { id: "kpi-org", label: "KPI องค์กร", href: "/services?view=kpi-org", icon: Target, permission: "kpi:update" },
      { id: "onsite", label: "พื้นที่เช็คอิน", href: "/services?view=onsite", icon: MapPinned, permission: "attendance:update" },
    ],
  },
  {
    id: "system",
    label: "ระบบ",
    items: [
      { id: "access", label: "สิทธิ์ผู้ใช้", href: "/services?view=access", icon: Shield, permission: "admin:read" },
      { id: "workflows", label: "เวิร์กโฟลว์", href: "/workflows", icon: GitBranch, permission: "workflow:read" },
      { id: "menu-settings", label: "ตั้งค่าเมนู", href: "/services?view=menu-settings", icon: Settings, permission: "admin:read" },
      { id: "all-services", label: "เมนูทั้งหมด", href: "/services", icon: LayoutGrid, permission: "dashboard:read" },
    ],
  },
];

/** Flat list of every mobile menu item (for settings toggles). */
export const MOBILE_ALL_ITEMS: MobileMenuItem[] = [
  ...MOBILE_EMPLOYEE_GROUPS.flatMap((g) => g.items),
  ...MOBILE_HR_GROUPS.flatMap((g) => g.items),
];

export const MOBILE_MENU_VISIBILITY_KEY = "gvone-mobile-menu-visibility";

export function getMobileMenuVisibility(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MOBILE_MENU_VISIBILITY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function setMobileMenuItemVisible(id: string, visible: boolean) {
  const current = getMobileMenuVisibility();
  current[id] = visible;
  localStorage.setItem(MOBILE_MENU_VISIBILITY_KEY, JSON.stringify(current));
}

export function filterVisibleMenuItems(items: MobileMenuItem[]): MobileMenuItem[] {
  const visibility = getMobileMenuVisibility();
  return items.filter((item) => visibility[item.id] !== false);
}
