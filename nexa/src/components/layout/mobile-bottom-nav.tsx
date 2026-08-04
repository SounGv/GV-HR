"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, Bot, UserRound, Clock } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

/**
 * 5-slot bottom tab bar for phones — hidden on md+: Home · Services ·
 * [Time, raised center FAB] · AI · Profile. "Services" opens the full
 * sidebar drawer (every module); the center FAB is attendance check-in,
 * kept raised since it's the single most-used action on this bar.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();
  const { setOpenMobile } = useSidebar();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const canCheckIn = can("attendance:read");
  const canAi = can("ai:read");

  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        <NavTab href="/dashboard" label="หน้าหลัก" icon={LayoutDashboard} active={isActive("/dashboard")} />

        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex h-full flex-col items-center justify-center gap-0.5 text-muted-foreground transition active:scale-95"
        >
          <LayoutGrid className="size-5" />
          <span className="text-[10px] font-medium">บริการ</span>
        </button>

        {/* Center raised check-in FAB — "Time" */}
        <div className="flex justify-center">
          {canCheckIn ? (
            <Link
              href="/attendance"
              aria-label="เช็คอินเข้างาน"
              className={cn(
                "-mt-7 flex size-14 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition active:scale-95",
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
      <Icon className={cn("size-5", active && "fill-primary/10")} />
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
}
