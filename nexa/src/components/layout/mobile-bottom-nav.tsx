"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { RApprove, RCalendarDays, RChart, RClipboardList, RHome, RStar, RUser, RUsers } from "@/components/shared/real-icons";
import { useAuth } from "@/features/auth/auth-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections } from "@/features/attendance-correction/hooks";
import { useMyPendingAppraisalTasks } from "@/features/appraisal-round/hooks";
import { cn } from "@/lib/utils";

/**
 * 5-slot floating liquid-glass tab bar for phones (a lit drop slides under the active tab) — hidden on md+. Three role-variant
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
  const correctionPendingQ = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
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
  const profileTab = { href: "/profile", label: "โปรไฟล์", icon: RUser, show: true, badge: 0 };

  const tabs = isHrTier
    ? [
        { href: "/dashboard", label: "หน้าหลัก", icon: RHome, show: true, badge: 0 },
        { href: "/employees", label: "พนักงาน", icon: RUsers, show: can("employee:read"), badge: 0 },
        {
          href: "/requests?view=approvals",
          label: "คำขอ",
          icon: RClipboardList,
          show: can("leave:read") || can("overtime:read"),
          badge: pendingCount,
        },
        { href: "/reports", label: "รายงาน", icon: RChart, show: can("report:read"), badge: 0 },
        profileTab,
      ]
    : isManagerTier
      ? [
          { href: "/dashboard", label: "หน้าหลัก", icon: RHome, show: true, badge: 0 },
          { href: "/employees", label: "ทีมของฉัน", icon: RUsers, show: can("employee:read"), badge: 0 },
          {
            href: "/requests?view=approvals",
            label: "อนุมัติ",
            icon: RApprove,
            show: can("leave:read") || can("overtime:read"),
            badge: pendingCount,
          },
          { href: reviewHref, label: "ประเมิน", icon: RStar, show: canReview, badge: pendingReviewCount },
          profileTab,
        ]
      : [
          { href: "/dashboard", label: "หน้าหลัก", icon: RHome, show: true, badge: 0 },
          { href: "/calendar", label: "ปฏิทิน", icon: RCalendarDays, show: can("calendar:read"), badge: 0 },
          {
            href: "/requests",
            label: "คำขอ",
            icon: RClipboardList,
            show: can("leave:read") || can("overtime:read"),
            badge: 0,
          },
          { href: reviewHref, label: "ประเมิน", icon: RStar, show: canReview, badge: pendingReviewCount },
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
    <nav
      aria-label="เมนูลัด"
      className="gv-lg fixed inset-x-3.5 bottom-[calc(14px+env(safe-area-inset-bottom))] z-40 h-[68px] rounded-full md:hidden"
    >
      <div className="relative grid h-full items-center px-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="gv-lg-drop pointer-events-none absolute top-1 left-1.5 h-[58px] rounded-full"
            style={{ width: `calc((100% - 12px) / ${count})`, transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {visibleTabs.map((t, i) => (
          <NavTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={i === activeIndex} badge={t.badge} />
        ))}
      </div>
    </nav>
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
        "relative z-10 flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-full transition active:scale-95 motion-reduce:active:scale-100",
        active ? "font-bold text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn("relative flex items-center justify-center transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.45,0.55,1)]", active && "-translate-y-0.5 scale-110")}>
        <Icon size={30} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1 text-xs font-semibold text-badge-foreground ring-2 ring-card">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[12px] font-semibold whitespace-nowrap">{label}</span>
    </Link>
  );
}
