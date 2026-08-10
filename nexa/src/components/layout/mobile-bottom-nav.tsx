"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clock, ClipboardList, Receipt, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { cn } from "@/lib/utils";

/**
 * 5-slot flat bottom tab bar for phones — hidden on md+: หน้าหลัก · เวลา ·
 * คำขอ · สลิป · โปรไฟล์. Matches the Master Prompt's mobile nav spec exactly;
 * AI and notifications are intentionally NOT tabs here (AI is excluded from
 * the employee mobile experience, notifications live as a bell icon on the
 * Home header instead). Tabs the account lacks permission for are hidden
 * rather than shown disabled, so the grid always fits whatever remains.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();

  const canApproveLeave = can("leave:approve");
  const canApproveOt = can("overtime:approve");
  const canApprove = canApproveLeave || canApproveOt;
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const pendingCount = (leavePendingQ.data?.data.length ?? 0) + (otPendingQ.data?.data.length ?? 0);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const tabs = [
    { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard, show: true, badge: 0 },
    { href: "/attendance", label: "เวลา", icon: Clock, show: can("attendance:read"), badge: 0 },
    {
      href: "/requests",
      label: "คำขอ",
      icon: ClipboardList,
      show: can("leave:read") || can("overtime:read"),
      badge: canApprove ? pendingCount : 0,
    },
    { href: "/payroll", label: "สลิป", icon: Receipt, show: can("payroll:read"), badge: 0 },
    { href: "/profile", label: "โปรไฟล์", icon: UserRound, show: true, badge: 0 },
  ].filter((t) => t.show);

  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div
        className="mx-auto grid h-16 max-w-md items-center px-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavTab key={t.href} href={t.href} label={t.label} icon={t.icon} active={isActive(t.href)} badge={t.badge} />
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
          <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white ring-2 ring-card">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
    </Link>
  );
}
