"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Bot, Menu, Clock, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

interface Item {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

const LEFT: Item[] = [
  { label: "หน้าหลัก", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { label: "การลา", href: "/leave", icon: CalendarDays, permission: "leave:read" },
];

const RIGHT: Item[] = [
  { label: "AI Assistant", href: "/ai", icon: Bot, permission: "ai:read" },
];

/** Bottom tab bar for phones — hidden on md+. Center raised button = quick check-in. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { can } = useAuth();
  const { setOpenMobile } = useSidebar();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const left = LEFT.filter((i) => can(i.permission));
  const right = RIGHT.filter((i) => can(i.permission));
  const canCheckIn = can("attendance:read");

  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
        {left.map((i) => (
          <NavTab key={i.href} item={i} active={isActive(i.href)} />
        ))}

        {/* Center raised check-in FAB */}
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

        {right.map((i) => (
          <NavTab key={i.href} item={i} active={isActive(i.href)} />
        ))}

        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex h-full flex-col items-center justify-center gap-0.5 text-muted-foreground transition active:scale-95"
        >
          <Menu className="size-5" />
          <span className="text-[10px] font-medium">เพิ่มเติม</span>
        </button>
      </div>
    </nav>
  );
}

function NavTab({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 transition active:scale-95",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "fill-primary/10")} />
      <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
    </Link>
  );
}
