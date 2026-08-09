"use client";

import Link from "next/link";
import { Bell, CalendarDays, Wallet, Star } from "lucide-react";
import { useNotifications } from "@/features/notification/hooks";
import { ClockCard } from "@/features/attendance/clock-card";
import { useMobileMenuGroups } from "./use-mobile-menu-groups";
import { MobileMenuTileGrid } from "./mobile-menu-tile-grid";

export interface MobileDashboardSnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveDaysRemaining: number;
  latestPayslip: { net: number; periodLabel: string } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Mobile Home tab — greeting + notification bell, the live check-in/out
 * action (ClockCard, reused as-is from the Attendance screen), a personal
 * snapshot, then the full quick-menu grid (same groups as "บริการ"/
 * `/services`, so employees never have to leave Home to reach them). No AI
 * surface here — mobile is intentionally AI-free for employees.
 */
export function MobileDashboardView({
  name,
  companyName,
  mine,
}: {
  name?: string | null;
  companyName?: string | null;
  mine: MobileDashboardSnapshot | null;
}) {
  const { data: notifData } = useNotifications();
  const unread = notifData?.data?.unread ?? 0;
  const groups = useMobileMenuGroups();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  })();

  return (
    <div className="min-h-full bg-muted md:hidden">
      <div className="flex items-start justify-between bg-primary px-4 pt-4 pb-6 text-primary-foreground">
        <div>
          <p className="text-sm opacity-80">
            {greeting}, {name} 👋
          </p>
          <p className="mt-0.5 text-xs opacity-70">{companyName}</p>
        </div>
        <Link
          href="/notifications"
          aria-label="การแจ้งเตือน"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <Bell className="size-4.5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white ring-2 ring-primary">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>

      <div className="-mt-3 space-y-5 px-4 pb-4">
        <ClockCard />

        {mine && (
          <div className="grid grid-cols-3 gap-3">
            <Link href="/leave" className="rounded-xl bg-card p-3.5 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                <CalendarDays className="size-4" />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">วันลาคงเหลือ</p>
              <p className="mt-0.5 text-base font-bold text-foreground">{mine.leaveDaysRemaining} วัน</p>
            </Link>
            <Link href="/payroll" className="rounded-xl bg-card p-3.5 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Wallet className="size-4" />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">เงินเดือนล่าสุด</p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {mine.latestPayslip ? fmtCurrency(mine.latestPayslip.net) : "-"}
              </p>
            </Link>
            <div className="rounded-xl bg-card p-3.5 shadow-sm">
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                <Star className="size-4" />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">คะแนนให้กำลังใจ</p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {mine.recognition.star + mine.recognition.award + mine.recognition.heart}
              </p>
            </div>
          </div>
        )}

        <MobileMenuTileGrid groups={groups} />
      </div>
    </div>
  );
}
