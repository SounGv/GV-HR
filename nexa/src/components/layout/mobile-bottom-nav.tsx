"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, Bot, Bell, UserRound, Clock } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";

/**
 * 5-slot bottom tab bar for phones — hidden on md+: Home · Services ·
 * [Time, raised center FAB] · AI (or Notifications, for accounts without AI
 * access) · Profile. "Services" is a curated quick-access icon grid (full
 * sidebar drawer is one tap further, via a link on that page); the center
 * FAB is attendance check-in, kept raised since it's the single most-used
 * action on this bar.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();
  const { data: notifData } = useNotifications();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const canCheckIn = can("attendance:read");
  const canAi = can("ai:read");
  const unread = notifData?.data?.unread ?? 0;

  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        <NavTab href="/dashboard" label="หน้าหลัก" icon={LayoutDashboard} active={isActive("/dashboard")} />

        <NavTab href="/services" label="บริการ" icon={LayoutGrid} active={isActive("/services")} />

        {/* Center raised check-in FAB — "Time" */}
        <div className="flex justify-center">
          {canCheckIn ? (
            <Link
              href="/attendance"
              aria-label="เช็คอินเข้างาน"
              className={cn(
                "-mt-7 flex size-14 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-4 ring-card transition active:scale-95",
                isActive("/attendance") && "ring-primary/20",
              )}
            >
              <Clock className="size-6" />
            </Link>
          ) : (
            <span className="size-14" />
          )}
        </div>

        {canAi ? (
          <NavTab href="/ai" label="AI" icon={Bot} active={isActive("/ai")} />
        ) : (
          <NavTab
            href="/notifications"
            label="แจ้งเตือน"
            icon={Bell}
            active={isActive("/notifications")}
            badge={unread}
          />
        )}

        <NavTab href="/profile" label="โปรไฟล์" icon={UserRound} active={isActive("/profile")} />
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
  badge?: number;
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
        {!!badge && (
          <span className="absolute -top-1 -right-1.5 flex min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white ring-2 ring-card">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
    </Link>
  );
}
