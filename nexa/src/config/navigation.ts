import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock,
  Timer,
  CalendarDays,
  CalendarCheck,
  Users,
  UserPlus,
  Boxes,
  Target,
  ClipboardCheck,
  Sparkles,
  GraduationCap,
  Wallet,
  ReceiptText,
  BarChart3,
  Megaphone,
  Bot,
  Settings,
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
    ],
  },
  {
    label: "การทำงาน",
    items: [
      { label: "เวลาเข้า-ออกงาน", href: "/attendance", icon: Clock, permission: "attendance:read", ready: true },
      { label: "การลา", href: "/leave", icon: CalendarDays, permission: "leave:read", ready: true },
      { label: "ล่วงเวลา (OT)", href: "/overtime", icon: Timer, permission: "overtime:read", ready: true },
      { label: "วันหยุด", href: "/holidays", icon: CalendarCheck, permission: "holiday:read", ready: true },
    ],
  },
  {
    label: "ข้อมูลพนักงาน",
    items: [
      { label: "พนักงานและองค์กร", href: "/employees", icon: Users, permission: "employee:read", ready: true },
      { label: "สรรหาพนักงาน", href: "/recruitment", icon: UserPlus, permission: "recruitment:read", ready: true },
      { label: "เอกสารและทรัพย์สิน", href: "/assets", icon: Boxes, permission: "asset:read", ready: true },
    ],
  },
  {
    label: "ประเมินและพัฒนา",
    items: [
      { label: "KPI & Level", href: "/kpi", icon: Target, permission: "kpi:read", ready: true },
      { label: "ประเมินผลงาน", href: "/performance", icon: ClipboardCheck, permission: "performance:read", ready: true },
      { label: "แบบประเมิน (AI)", href: "/ai-evaluation", icon: Sparkles, permission: "ai:read", ready: true },
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
      { label: "NEXA AI", href: "/ai", icon: Bot, permission: "ai:read", ready: true },
      { label: "ผู้ดูแลระบบ", href: "/admin", icon: Settings, permission: "admin:read", ready: true },
    ],
  },
];
