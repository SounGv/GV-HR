"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, Bot, UserRound, Clock } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * 5-slot bottom tab bar for phones — hidden on md+: Home · Services ·
 * [Time, raised center FAB] · AI · Profile. "Services" is a curated
 * quick-access icon grid (full sidebar drawer is one tap further, via a
 * link on that page); the center FAB is attendance check-in, kept raised
 * since it's the single most-used action on this bar.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const canCheckIn = can("attendance:read");
  const canAi = can("ai:read");

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
          <span />
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
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 transition active:scale-95",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
      <span className="text-[11px] font-semibold whitespace-nowrap">{label}</span>
    </Link>
  );
}
