"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  UsersRound,
  BarChart3,
  Star,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";
import { ProfileDrawer } from "./profile-drawer";

/**
 * 5-slot flat bottom tab bar for phones — hidden on md+. Three role-variant
 * tab sets per the redesign spec (Employee / Manager / HR), sharing the
 * same live-badge data sources — only which tabs carry which counts (and
 * which pages the middle 3 slots point at) changes per role:
 *   Employee: หน้าหลัก · ปฏิทิน · คำขอ · ประเมิน · โปรไฟล์
 *   Manager:  หน้าหลัก · ทีมของฉัน · อนุมัติ · ประเมิน · โปรไฟล์
 *   HR:       Dashboard · พนักงาน · คำขอ · รายงาน · โปรไฟล์
 * "โปรไฟล์" opens a drawer (see ProfileDrawer) instead of navigating away,
 * so the full categorized quick-menu is always one tap from anywhere.
 * AI Assistant is intentionally never a tab — it's reached from the "ภาพรวม"
 * nav group / floating launcher on desktop, and isn't part of the mobile
 * tab bar for any role per the redesign spec.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const canApproveLeave = can("leave:approve");
  const canApproveOt = can("overtime:approve");
  const canApprove = canApproveLeave || canApproveOt;
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const pendingCount = (leavePendingQ.data?.data.length ?? 0) + (otPendingQ.data?.data.length ?? 0);

  const canReview = can("performance:read");
  const pendingReviewsQ = useMyPendingResponses();
  const pendingReviewCount = canReview ? (pendingReviewsQ.data?.data.length ?? 0) : 0;

  const notificationsQ = useNotifications();
  const unreadCount = notificationsQ.data?.data.unread ?? 0;

  // Same operational definition of "Manager" already used for the pending-
  // approval badge above (can approve leave/OT) — no separate role concept.
  const isHrTier = can("employee:update");
  const isManagerTier = !isHrTier && canApprove;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tabs = isHrTier
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true, badge: 0 },
        { href: "/employees", label: "พนักงาน", icon: UsersRound, show: can("employee:read"), badge: 0 },
        {
          href: "/requests",
          label: "คำขอ",
          icon: ClipboardCheck,
          show: can("leave:read") || can("overtime:read"),
          badge: pendingCount,
        },
        { href: "/reports", label: "รายงาน", icon: BarChart3, show: can("report:read"), badge: 0 },
      ]
    : isManagerTier
      ? [
          { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard, show: true, badge: 0 },
          { href: "/employees", label: "ทีมของฉัน", icon: UsersRound, show: can("employee:read"), badge: 0 },
          {
            href: "/requests",
            label: "อนุมัติ",
            icon: ClipboardCheck,
            show: can("leave:read") || can("overtime:read"),
            badge: pendingCount,
          },
          { href: "/performance", label: "ประเมิน", icon: Star, show: canReview, badge: pendingReviewCount },
        ]
      : [
          { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard, show: true, badge: 0 },
          { href: "/calendar", label: "ปฏิทิน", icon: CalendarDays, show: can("calendar:read"), badge: 0 },
          {
            href: "/requests",
            label: "คำขอ",
            icon: ClipboardList,
            show: can("leave:read") || can("overtime:read"),
            badge: 0,
          },
          { href: "/performance", label: "ประเมิน", icon: Star, show: canReview, badge: pendingReviewCount },
        ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <>
      <nav
        aria-label="เมนูลัด"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div
          className="mx-auto grid h-16 max-w-md items-center px-1"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((t) => (
            <NavTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={isActive(t.href)} badge={t.badge} />
          ))}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 transition active:scale-95",
              profileOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <UserRound className={cn("size-5", profileOpen && "stroke-[2.5px]")} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[9px] font-semibold text-badge-foreground ring-2 ring-card">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-[12px] font-semibold whitespace-nowrap">โปรไฟล์</span>
          </button>
        </div>
      </nav>
      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} unreadCount={unreadCount} />
    </>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 transition active:scale-95",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[9px] font-semibold text-badge-foreground ring-2 ring-card">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[12px] font-semibold whitespace-nowrap">{label}</span>
    </Link>
  );
}
