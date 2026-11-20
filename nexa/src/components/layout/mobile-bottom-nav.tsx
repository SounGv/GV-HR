"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, House, Star, User, UsersRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections } from "@/features/attendance-correction/hooks";
import { useMyPendingAppraisalTasks } from "@/features/appraisal-round/hooks";
import { cn } from "@/lib/utils";

/**
 * 5-slot flat tab bar for phones (Favpo style: white bar on the screen edge, a blue line over the active tab) — hidden on md+. Three role-variant
 * tab sets per the redesign spec (Employee / Manager / HR), sharing the
 * same live-badge data sources — only which tabs carry which counts (and
 * which pages the middle 3 slots point at) changes per role:
 *   Employee: หน้าหลัก · ปฏิทิน · คำขอ · ประเมิน · โปรไฟล์
 *   Manager:  หน้าหลัก · ทีมของฉัน · อนุมัติ · ประเมิน · โปรไฟล์
 *   HR:       หน้าหลัก · พนักงาน · คำขอ · รายงาน · โปรไฟล์
 * "โปรไฟล์" links straight to /profile — the mobile profile page already
 * has security, notifications, and logout on it (see MobileProfileView), so
 * routing through the account drawer first was just an extra tap for no
 * extra reach. AI Assistant is intentionally never a tab — it's reached
 * from the "ภาพรวม" nav group / floating launcher on desktop, and isn't
 * part of the mobile tab bar for any role per the redesign spec.
 */
/** The tabs this account sees (by role) and whether a tab is the current page. Shared with the page header, which hides its back arrow on a tab. */
export function useMobileTabs() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const { can, canAny } = useAuth();

  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);
  const canApprove = canApproveLeave || canApproveOt || canApproveCorrection;
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const correctionPendingQ = useAttendanceCorrections("team", "PENDING", {
    enabled: canApproveCorrection,
  });
  const pendingCount =
    (leavePendingQ.data?.data.length ?? 0) +
    (otPendingQ.data?.data.length ?? 0) +
    (correctionPendingQ.data?.data.length ?? 0);

  const pendingReviewCount = useMyPendingAppraisalTasks().items.length;
  const canReview = can("performance:read") || pendingReviewCount > 0;
  // With work waiting, the tab opens the to-do list directly; otherwise the results hub.
  const reviewHref = pendingReviewCount > 0 ? "/appraisal/tasks" : "/performance";

  // Same operational definition of "Manager" already used for the pending-
  // approval badge above (can approve leave/OT) — no separate role concept.
  const isHrTier = can("employee:update");
  const isManagerTier = !isHrTier && canApprove;

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    const onPath = pathname === path || pathname.startsWith(`${path}/`);
    // The approvals tab lights up only on the queue, not while the person looks at their own requests (same page, other view).
    if (onPath && query?.includes("view=approvals")) return view === "approvals";
    return onPath;
  };

  // The unread count lives on the bell in each page header; the profile tab carries none, so the same number is not shown twice.
  const profileTab = { href: "/profile", label: "โปรไฟล์", icon: User, show: true, badge: 0 };

  const tabs = isHrTier
    ? [
        { href: "/dashboard", label: "หน้าหลัก", icon: House, show: true, badge: 0 },
        {
          href: "/employees",
          label: "พนักงาน",
          icon: UsersRound,
          show: can("employee:read"),
          badge: 0,
        },
        {
          href: "/requests?view=approvals",
          label: "คำขอ",
          icon: ClipboardList,
          show: can("leave:read") || can("overtime:read"),
          badge: pendingCount,
        },
        { href: "/reports", label: "รายงาน", icon: BarChart3, show: can("report:read"), badge: 0 },
        profileTab,
      ]
    : isManagerTier
      ? [
          { href: "/dashboard", label: "หน้าหลัก", icon: House, show: true, badge: 0 },
          {
            href: "/employees",
            label: "ทีมของฉัน",
            icon: UsersRound,
            show: can("employee:read"),
            badge: 0,
          },
          {
            href: "/requests?view=approvals",
            label: "อนุมัติ",
            icon: ClipboardCheck,
            show: can("leave:read") || can("overtime:read"),
            badge: pendingCount,
          },
          {
            href: reviewHref,
            label: "ประเมิน",
            icon: Star,
            show: canReview,
            badge: pendingReviewCount,
          },
          profileTab,
        ]
      : [
          { href: "/dashboard", label: "หน้าหลัก", icon: House, show: true, badge: 0 },
          {
            href: "/calendar",
            label: "ปฏิทิน",
            icon: CalendarDays,
            show: can("calendar:read"),
            badge: 0,
          },
          {
            href: "/requests",
            label: "คำขอ",
            icon: ClipboardList,
            show: can("leave:read") || can("overtime:read"),
            badge: 0,
          },
          {
            href: reviewHref,
            label: "ประเมิน",
            icon: Star,
            show: canReview,
            badge: pendingReviewCount,
          },
          profileTab,
        ];

  const visibleTabs = tabs.filter((t) => t.show);
  return { visibleTabs, isActive };
}

export function MobileBottomNav() {
  const { visibleTabs, isActive } = useMobileTabs();
  const activeIndex = visibleTabs.findIndex((t) => isActive(t.href));
  const count = visibleTabs.length;

  return (
    <>
      <nav
        aria-label="เมนูลัด"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lg-edge)] bg-[var(--lg-glass-strong)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="relative grid h-[64px] items-stretch" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {visibleTabs.map((t, i) => (
            <NavTab
              key={t.href}
              href={t.href}
              label={t.label}
              icon={t.icon}
              active={i === activeIndex}
              badge={t.badge}
            />
          ))}
        </div>
      </nav>
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
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-10 flex h-full flex-col items-center justify-center gap-0.5 transition-colors",
        active ? "font-bold text-[#0d47a1] dark:text-[#90caf9]" : "text-muted-foreground",
      )}
    >
      {active && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-primary" />}
      <span className="relative flex items-center justify-center">
        <Icon size={24} />
        {badge > 0 && (
          <span className="bg-badge text-badge-foreground ring-card absolute -top-1.5 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ring-2">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[12px] whitespace-nowrap">{label}</span>
    </Link>
  );
}
