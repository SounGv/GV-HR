import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock,
  Timer,
  CalendarDays,
  CalendarCheck,
  CalendarRange,
  CalendarClock,
  Users,
  Network,
  UserPlus,
  Boxes,
  Target,
  ClipboardCheck,
  GraduationCap,
  Wallet,
  ReceiptText,
  BarChart3,
  Megaphone,
  GitBranch,
  Bot,
  Settings,
  Plug,
  Building2,
  MapPinned,
  Upload,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission key required to see this item (RBAC). */
  permission: string;
  /** false → module not built yet; links to the coming-soon placeholder. */
  ready?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      { label: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read", ready: true },
      { label: "ปฏิทินองค์กร", href: "/calendar", icon: CalendarRange, permission: "calendar:read", ready: true },
    ],
  },
  {
    label: "การทำงาน",
    items: [
      { label: "เวลาเข้า-ออกงาน", href: "/attendance", icon: Clock, permission: "attendance:read", ready: true },
      { label: "ตั้งค่าพื้นที่เช็คอิน", href: "/attendance/settings", icon: MapPinned, permission: "attendance:update", ready: true },
      { label: "การลา", href: "/leave", icon: CalendarDays, permission: "leave:read", ready: true },
      { label: "ล่วงเวลา (OT)", href: "/overtime", icon: Timer, permission: "overtime:read", ready: true },
      { label: "กะการทำงาน", href: "/shifts", icon: CalendarClock, permission: "shift:read", ready: true },
      { label: "วันหยุด", href: "/holidays", icon: CalendarCheck, permission: "holiday:read", ready: true },
    ],
  },
  {
    label: "ข้อมูลพนักงาน",
    items: [
      { label: "พนักงาน", href: "/employees", icon: Users, permission: "employee:read", ready: true },
      { label: "นำเข้าพนักงาน", href: "/employees/import", icon: Upload, permission: "employee:create", ready: true },
      { label: "โครงสร้างองค์กร", href: "/organization", icon: Network, permission: "employee:read", ready: true },
      { label: "สาขา", href: "/branches", icon: Building2, permission: "admin:read", ready: true },
      { label: "ศูนย์ต้นทุน", href: "/cost-centers", icon: Wallet, permission: "admin:read", ready: true },
      { label: "สรรหาพนักงาน", href: "/recruitment", icon: UserPlus, permission: "recruitment:read", ready: true },
      { label: "เอกสารและทรัพย์สิน", href: "/assets", icon: Boxes, permission: "asset:read", ready: true },
    ],
  },
  {
    label: "ประเมินและพัฒนา",
    items: [
      { label: "KPI & Level", href: "/kpi", icon: Target, permission: "kpi:read", ready: true },
      { label: "ประเมินผลงาน", href: "/performance", icon: ClipboardCheck, permission: "performance:read", ready: true },
      { label: "อบรมและพัฒนา", href: "/training", icon: GraduationCap, permission: "training:read", ready: true },
    ],
  },
  {
    label: "เงินเดือน",
    items: [
      { label: "เงินเดือนและสลิป", href: "/payroll", icon: Wallet, permission: "payroll:read", ready: true },
      { label: "เบิกจ่าย", href: "/expenses", icon: ReceiptText, permission: "expense:read", ready: true },
    ],
  },
  {
    label: "ข้อมูลและรายงาน",
    items: [
      { label: "รายงานและวิเคราะห์", href: "/reports", icon: BarChart3, permission: "report:read", ready: true },
    ],
  },
  {
    label: "สื่อสารองค์กร",
    items: [
      { label: "ประกาศและแจ้งเตือน", href: "/announcements", icon: Megaphone, permission: "announcement:read", ready: true },
    ],
  },
  {
    label: "ระบบและตั้งค่า",
    items: [
      { label: "เวิร์กโฟลว์อนุมัติ", href: "/workflows", icon: GitBranch, permission: "workflow:read", ready: true },
      { label: "NEXA AI", href: "/ai", icon: Bot, permission: "ai:read", ready: true },
      { label: "ข้อมูลบริษัท", href: "/company", icon: Building2, permission: "admin:read", ready: true },
      { label: "ผู้ดูแลระบบ", href: "/admin", icon: Settings, permission: "admin:read", ready: true },
      { label: "การเชื่อมต่อระบบ", href: "/integrations", icon: Plug, permission: "admin:read", ready: true },
    ],
  },
];
