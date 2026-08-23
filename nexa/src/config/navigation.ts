import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  Bell,
  BookOpen,
  ScanLine,
  PencilLine,
  TriangleAlert,
  CalendarClock,
  CalendarCheck,
  FilePlus2,
  ClipboardList,
  ClipboardCheck,
  Timer,
  UsersRound,
  UserPlus,
  Boxes,
  Building2,
  Network,
  Target,
  CalendarPlus,
  GraduationCap,
  ReceiptText,
  BarChart3,
  Megaphone,
  Upload,
  Download,
  MapPinned,
  GitBranch,
  Plug,
  Settings2,
  Bot,
  LogOut,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission key required to see this item (RBAC). */
  permission: string;
  /** false → module not built yet; links to the coming-soon placeholder. */
  ready?: boolean;
  /** Live numeric badge instead of the static "coming soon" text badge —
   * resolved in AppSidebar from the same data sources the mobile bottom
   * nav already uses (no new queries invented). */
  badgeKey?: "pendingApprovals" | "pendingReviews" | "unreadNotifications";
  /** Renders as a sign-out action button instead of a Link. */
  isLogout?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Redesign spec's information architecture — every item still points at an
 * existing route (some via `?view=`/`?tab=` query params on an existing
 * unified page, so nothing is duplicated); "เงินเดือน" stays out entirely
 * per the separate, still-standing "hidden pending HR" decision.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read", ready: true },
      { label: "ปฏิทินองค์กร", href: "/calendar", icon: CalendarDays, permission: "calendar:read", ready: true },
      { label: "AI Assistant", href: "/ai", icon: Bot, permission: "ai:read", ready: true },
      {
        label: "แจ้งเตือน",
        href: "/notifications",
        icon: Bell,
        permission: "dashboard:read",
        ready: true,
        badgeKey: "unreadNotifications",
      },
      { label: "คู่มือการใช้งาน", href: "/help", icon: BookOpen, permission: "dashboard:read", ready: true },
    ],
  },
  {
    label: "เวลาทำงาน",
    items: [
      { label: "เข้างาน / ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read", ready: true },
      { label: "แก้ไขเวลาเข้า-ออกงาน", href: "/attendance/corrections", icon: PencilLine, permission: "attendance:read", ready: true },
      { label: "มาสาย / ขาดงาน", href: "/reports?view=attendance_daily", icon: TriangleAlert, permission: "report:read", ready: true },
      { label: "กะการทำงาน", href: "/shifts", icon: CalendarClock, permission: "shift:read", ready: true },
      { label: "วันหยุด", href: "/holidays", icon: CalendarCheck, permission: "holiday:read", ready: true },
    ],
  },
  {
    label: "การลาและคำขอ",
    items: [
      { label: "คำขอลา", href: "/leave/new", icon: FilePlus2, permission: "leave:read", ready: true },
      {
        label: "คำขอรออนุมัติ",
        href: "/requests",
        icon: ClipboardCheck,
        permission: "leave:read",
        ready: true,
        badgeKey: "pendingApprovals",
      },
      { label: "ประวัติการลา", href: "/leave", icon: ClipboardList, permission: "leave:read", ready: true },
      { label: "ล่วงเวลา (OT)", href: "/overtime", icon: Timer, permission: "overtime:read", ready: true },
    ],
  },
  {
    label: "พนักงาน",
    items: [
      { label: "รายชื่อพนักงาน", href: "/employees", icon: UsersRound, permission: "employee:read", ready: true },
      { label: "แผนกและตำแหน่ง", href: "/organization?tab=departments", icon: Building2, permission: "employee:read", ready: true },
      { label: "โครงสร้างองค์กร", href: "/organization?tab=chart", icon: Network, permission: "employee:read", ready: true },
      { label: "สรรหาพนักงาน", href: "/recruitment", icon: UserPlus, permission: "recruitment:read", ready: true },
      { label: "เอกสารและทรัพย์สิน", href: "/assets", icon: Boxes, permission: "asset:read", ready: true },
      { label: "สาขา", href: "/branches", icon: Building2, permission: "admin:read", ready: true },
    ],
  },
  {
    label: "ประเมินและพัฒนา",
    items: [
      { label: "ประเมินผล", href: "/performance", icon: ClipboardCheck, permission: "performance:read", ready: true, badgeKey: "pendingReviews" },
      { label: "KPI & Level", href: "/kpi", icon: Target, permission: "kpi:read", ready: true },
      { label: "นัดประชุม", href: "/meetings", icon: CalendarPlus, permission: "meeting:read", ready: true },
      { label: "อบรมและพัฒนา", href: "/training", icon: GraduationCap, permission: "training:read", ready: true },
    ],
  },
  {
    // "เงินเดือนและสลิป" (payroll) deliberately hidden for now — HR wants
    // to focus rollout on attendance/leave and the evaluation system first.
    // Re-add { label: "เงินเดือนและสลิป", href: "/payroll", icon: Wallet,
    // permission: "payroll:read", ready: true } here when ready.
    label: "เบิกจ่าย",
    items: [
      { label: "เบิกจ่าย", href: "/expenses", icon: ReceiptText, permission: "expense:read", ready: true },
    ],
  },
  {
    label: "รายงานและสื่อสาร",
    items: [
      { label: "รายงานการเข้างาน", href: "/reports?view=attendance", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานการลา", href: "/reports?view=leave", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานประเมินผล", href: "/reports?view=performance", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานและวิเคราะห์ทั้งหมด", href: "/reports", icon: BarChart3, permission: "report:read", ready: true },
      { label: "ประกาศและแจ้งเตือน", href: "/announcements", icon: Megaphone, permission: "announcement:read", ready: true },
    ],
  },
  {
    label: "ข้อมูลระบบ",
    items: [
      { label: "นำเข้าข้อมูล", href: "/import", icon: Upload, permission: "employee:create", ready: true },
      { label: "ส่งออกข้อมูล", href: "/reports", icon: Download, permission: "report:read", ready: true },
      { label: "ประวัติการนำเข้า / ส่งออก", href: "/admin?tab=audit", icon: ClipboardList, permission: "admin:read", ready: true },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { label: "ข้อมูลบริษัท", href: "/company", icon: Building2, permission: "admin:read", ready: true },
      { label: "ศูนย์ต้นทุน", href: "/cost-centers", icon: Building2, permission: "admin:read", ready: true },
      { label: "ตั้งค่าพื้นที่เช็คอิน", href: "/attendance/settings", icon: MapPinned, permission: "attendance:update", ready: true },
      { label: "เวิร์กโฟลว์อนุมัติ", href: "/workflows", icon: GitBranch, permission: "workflow:read", ready: true },
      { label: "การเชื่อมต่อระบบ", href: "/integrations", icon: Plug, permission: "admin:read", ready: true },
      { label: "ผู้ดูแลระบบ", href: "/admin", icon: Settings2, permission: "admin:read", ready: true },
      { label: "ออกจากระบบ", href: "#", icon: LogOut, permission: "dashboard:read", ready: true, isLogout: true },
    ],
  },
];
