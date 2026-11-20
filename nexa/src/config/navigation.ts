import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { GvHomeIcon, GvTimeIcon, GvLeaveIcon, GvPeopleIcon, GvEvaluationIcon, GvMoneyIcon, GvReportIcon, GvSystemIcon, type GvIconProps } from "@/components/shared/gv-icons";
import {
  LayoutDashboard,
  CalendarDays,
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
  CalendarPlus,
  GraduationCap,
  ReceiptText,
  Stethoscope,
  Landmark,
  History,
  BarChart3,
  Megaphone,
  Upload,
  MapPinned,
  GitBranch,
  Plug,
  Settings2,
  Bot,
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
  /** Renders as a button that opens the floating AI chat panel (desktop)
   * instead of navigating to `href` — see AiPanelProvider/useAiPanel. */
  opensAiPanel?: boolean;
  /** Shown on its own, prominently, above the menu groups instead of inside
   * its group (AI Assistant). Still listed here so search and saved menu
   * layouts keep seeing it. */
  featured?: boolean;
  /** A small heading above this item in the side menu when it differs from the item before it (settings group). */
  section?: string;
}

export interface NavGroup {
  label: string;
  /** Group-header icon chip — redesign spec: each group reads at a glance by
   * its own color instead of every row sharing one plain treatment. */
  icon: ComponentType<GvIconProps>;
  chipColor: string;
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
    icon: GvHomeIcon,
    chipColor: "#1976d2",
    items: [
      { label: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read", ready: true },
      { label: "ปฏิทินองค์กร", href: "/calendar", icon: CalendarDays, permission: "calendar:read", ready: true },
      // Everyone reads announcements and meetings, so they sit here and not under the HR reports (menu review, Nov 2026).
      { label: "ประกาศและแจ้งเตือน", href: "/announcements", icon: Megaphone, permission: "announcement:read", ready: true },
      { label: "นัดประชุม", href: "/meetings", icon: CalendarPlus, permission: "meeting:read", ready: true },
      { label: "น้องวีบอท", href: "/ai", icon: Bot, permission: "ai:read", ready: true, opensAiPanel: true, featured: true },
      // HR only (employee:update): the guide documents HR workflows and the page is guarded the same way. A guide written for
      // staff would let this open to everyone. The notification list has no entry of its own any more: the bell at the top opens it.
      { label: "คู่มือการใช้งาน", href: "/help", icon: BookOpen, permission: "employee:update", ready: true },
    ],
  },
  {
    label: "เวลาทำงาน",
    icon: GvTimeIcon,
    chipColor: "#1976d2",
    items: [
      { label: "เข้างาน / ออกงาน", href: "/attendance", icon: ScanLine, permission: "attendance:read", ready: true },
      { label: "แก้ไขเวลาเข้า-ออกงาน", href: "/attendance/corrections", icon: PencilLine, permission: "attendance:read", ready: true },
      { label: "กะการทำงาน", href: "/shifts", icon: CalendarClock, permission: "shift:read", ready: true },
      { label: "วันหยุด", href: "/holidays", icon: CalendarCheck, permission: "holiday:read", ready: true },
      { label: "ดูมาสาย / ขาดงานรายวัน", href: "/reports?view=attendance_daily", icon: TriangleAlert, permission: "report:read", ready: true },
    ],
  },
  {
    label: "การลาและคำขอ",
    icon: GvLeaveIcon,
    chipColor: "#1976d2",
    items: [
      { label: "ขอลา", href: "/leave/new", icon: FilePlus2, permission: "leave:read", ready: true },
      { label: "ประวัติการลา", href: "/leave", icon: ClipboardList, permission: "leave:read", ready: true },
      { label: "ล่วงเวลา (OT)", href: "/overtime", icon: Timer, permission: "overtime:read", ready: true },
      {
        label: "คำขอรออนุมัติ",
        href: "/requests?view=approvals",
        icon: ClipboardCheck,
        permission: "leave:read",
        ready: true,
        badgeKey: "pendingApprovals",
      },
    ],
  },
  {
    label: "พนักงาน",
    icon: GvPeopleIcon,
    chipColor: "#1976d2",
    items: [
      { label: "รายชื่อพนักงาน", href: "/employees", icon: UsersRound, permission: "employee:read", ready: true },
      { label: "แผนกและตำแหน่ง", href: "/organization?tab=departments", icon: Building2, permission: "employee:read", ready: true },
      { label: "โครงสร้างองค์กร", href: "/organization?tab=chart", icon: Network, permission: "employee:read", ready: true },
      { label: "สรรหาพนักงาน", href: "/recruitment", icon: UserPlus, permission: "recruitment:read", ready: true },
      { label: "เอกสารและทรัพย์สิน", href: "/assets", icon: Boxes, permission: "asset:read", ready: true },
    ],
  },
  {
    label: "ประเมินและพัฒนา",
    icon: GvEvaluationIcon,
    chipColor: "#1976d2",
    items: [
      // Kept to four (2026-11-11, the menu had 11 and confused people): the two
      // "ของฉัน" pages for everyone, one entry for HR into the evaluation
      // system (its own tabs: ภาพรวม / แบบประเมิน / รอบประเมิน / KPI / ตั้งค่า),
      // and training. The old /performance and /kpi pages (2 old reviews, 6
      // goals, no rounds) stay reachable by address but leave the menu.
      { label: "งานประเมินของฉัน", href: "/appraisal/tasks", icon: ClipboardCheck, permission: "notification:read", ready: true, badgeKey: "pendingReviews" },
      { label: "ผลประเมินของฉัน", href: "/appraisal/my-results", icon: ClipboardList, permission: "notification:read", ready: true },
      { label: "จัดการประเมิน", href: "/appraisal", icon: Settings2, permission: "campaign:manage", ready: true },
      { label: "อบรมและพัฒนา", href: "/training", icon: GraduationCap, permission: "training:read", ready: true },
    ],
  },
  {
    // "เงินเดือนและสลิป" (payroll) deliberately hidden for now — HR wants
    // to focus rollout on attendance/leave and the evaluation system first.
    // Re-add { label: "เงินเดือนและสลิป", href: "/payroll", icon: Wallet,
    // permission: "payroll:read", ready: true } here when ready.
    label: "เบิกจ่าย",
    icon: GvMoneyIcon,
    chipColor: "#1976d2",
    items: [
      { label: "ประวัติสวัสดิการของฉัน", href: "/benefits/history", icon: History, permission: "expense:read", ready: true },
      { label: "เบิกจ่ายทั่วไป", href: "/expenses", icon: ReceiptText, permission: "expense:read", ready: true },
      { label: "ค่ารักษาพยาบาล", href: "/benefits/medical", icon: Stethoscope, permission: "expense:read", ready: true },
      { label: "กู้เงินบริษัท", href: "/benefits/loans", icon: Landmark, permission: "expense:read", ready: true },
      { label: "รายงานสวัสดิการ", href: "/benefits/report", icon: BarChart3, permission: "expense:approve", ready: true },
    ],
  },
  {
    label: "รายงาน",
    icon: GvReportIcon,
    chipColor: "#1976d2",
    items: [
      { label: "สรุปการเข้างานรายเดือน", href: "/reports?view=attendance", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานการลา", href: "/reports?view=leave", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานประเมินผล", href: "/reports?view=performance", icon: BarChart3, permission: "report:read", ready: true },
      { label: "รายงานและวิเคราะห์ทั้งหมด", href: "/reports", icon: BarChart3, permission: "report:read", ready: true },
    ],
  },
  {
    // One settings group instead of "ข้อมูลระบบ" + "ระบบ" (two names people could not tell apart). The headings inside it
    // (section) show only in the side menu; the tab row at the top lists the same pages in this order.
    label: "ตั้งค่าระบบ",
    icon: GvSystemIcon,
    chipColor: "#1976d2",
    items: [
      { label: "ข้อมูลบริษัท", href: "/company", icon: Building2, permission: "admin:read", ready: true, section: "บริษัท" },
      { label: "สาขา", href: "/branches", icon: Building2, permission: "admin:read", ready: true, section: "บริษัท" },
      { label: "ศูนย์ต้นทุน", href: "/cost-centers", icon: Building2, permission: "admin:read", ready: true, section: "บริษัท" },
      { label: "ตั้งค่าพื้นที่เช็คอิน", href: "/attendance/settings", icon: MapPinned, permission: "attendance:update", ready: true, section: "เวลาและการลา" },
      { label: "ตั้งสิทธิ์ลาปีใหม่", href: "/leave/year-setup", icon: CalendarCheck, permission: "employee:update", ready: true, section: "เวลาและการลา" },
      { label: "สิทธิ์ลารายคน", href: "/leave/entitlements", icon: ClipboardList, permission: "employee:update", ready: true, section: "เวลาและการลา" },
      { label: "เวิร์กโฟลว์อนุมัติ", href: "/workflows", icon: GitBranch, permission: "workflow:read", ready: true, section: "เวลาและการลา" },
      { label: "นำเข้าข้อมูล", href: "/import", icon: Upload, permission: "employee:create", ready: true, section: "ข้อมูล" },
      { label: "บันทึกการใช้งานและการนำเข้า", href: "/admin?tab=audit", icon: ClipboardList, permission: "admin:read", ready: true, section: "ข้อมูล" },
      { label: "ผู้ดูแลระบบ", href: "/admin", icon: Settings2, permission: "admin:read", ready: true, section: "ผู้ดูแล" },
      { label: "การเชื่อมต่อระบบ", href: "/integrations", icon: Plug, permission: "admin:read", ready: true, section: "ผู้ดูแล" },
    ],
  },
];
