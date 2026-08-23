"use client";

import Link from "next/link";
import { Bell, ChevronRight, LogOut, Settings2, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/auth-context";
import { fullName } from "@/lib/format";
import { MobileMenuTileGrid } from "@/components/mobile/mobile-menu-tile-grid";
import { useMobileMenuGroups } from "@/components/mobile/use-mobile-menu-groups";

/**
 * The mobile bottom nav's "โปรไฟล์" tab opens this instead of navigating
 * away — the full categorized quick-menu (same groups/tiles as "บริการ" and
 * the Home tab) plus account actions, always one tap from anywhere.
 */
export function ProfileDrawer({
  open,
  onOpenChange,
  unreadCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
}) {
  const { user, logout } = useAuth();
  const { groups, hrStartIndex } = useMobileMenuGroups();

  const displayName = user.employee ? fullName(user.employee.firstName, user.employee.lastName) : user.email;
  const subtitle = user.employee
    ? `${user.employee.position?.title ?? "พนักงาน"} • ${user.employee.department?.name ?? "—"}`
    : user.roles.join(", ") || "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl px-4 pt-2 pb-6">
        <SheetHeader className="sr-only">
          <SheetTitle>เมนู</SheetTitle>
        </SheetHeader>

        <Link
          href="/profile"
          onClick={() => onOpenChange(false)}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-card p-3 active:bg-muted"
        >
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-icon-chip-bg text-icon-chip-fg">
            {user.employee?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.employee.avatarUrl} alt={displayName} className="size-full object-cover" />
            ) : (
              <User className="size-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-foreground">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Link
            href="/notifications"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground active:bg-muted"
          >
            <span className="relative">
              <Bell className="size-[18px] text-icon-chip-fg" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex min-w-3.5 items-center justify-center rounded-full bg-badge px-1 text-[8px] font-semibold text-badge-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            แจ้งเตือน
          </Link>
          <Link
            href="/help"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-[13px] font-semibold text-foreground active:bg-muted"
          >
            <Settings2 className="size-[18px] text-icon-chip-fg" />
            คู่มือการใช้งาน
          </Link>
        </div>

        <div className="space-y-5" onClick={() => onOpenChange(false)}>
          <MobileMenuTileGrid groups={groups} hrStartIndex={hrStartIndex} />
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            logout();
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive-muted px-4 py-3 text-[13px] font-bold text-destructive active:scale-[0.99]"
        >
          <LogOut className="size-4" />
          ออกจากระบบ
        </button>
      </SheetContent>
    </Sheet>
  );
}
