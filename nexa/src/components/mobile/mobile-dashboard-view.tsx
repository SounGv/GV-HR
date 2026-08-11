"use client";

import Link from "next/link";
import { Bell, CalendarDays, Wallet, Star, ClipboardCheck, ChevronRight } from "lucide-react";
import { useNotifications } from "@/features/notification/hooks";
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { formatRelativeTime } from "@/lib/format";
import { MobileCheckinCard } from "./mobile-checkin-card";
import { useMobileMenuGroups } from "./use-mobile-menu-groups";
import { MobileMenuTileGrid } from "./mobile-menu-tile-grid";

export interface MobileDashboardSnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveBalances: { type: string; label: string; remaining: number }[];
  latestPayslip: { net: number; periodLabel: string } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Mobile Home tab — greeting + notification bell, the live check-in/out
 * action (MobileCheckinCard, the mobile-only redesign of the desktop
 * ClockCard), a personal snapshot, then the full quick-menu grid (same
 * groups as "บริการ"/`/services`, so employees never have to leave Home to
 * reach them). No AI surface here — mobile is intentionally AI-free for
 * employees.
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
  const latestNotif = notifData?.data?.items?.[0] ?? null;
  const { groups, hrStartIndex } = useMobileMenuGroups();
  const { data: pendingData } = useMyPendingResponses();
  const pending = pendingData?.data ?? [];
  const pendingCount = pending.length;
  const nextPending = pending[0] ?? null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  })();

  return (
    <div className="min-h-full bg-muted md:hidden">
      <div className="flex items-start justify-between bg-sidebar px-4 pt-4 pb-6 text-white">
        <div>
          <p className="text-sm font-medium text-white">
            {greeting}, {name} 👋
          </p>
          <p className="mt-0.5 text-xs text-slate-300">{companyName}</p>
        </div>
        <Link
          href="/notifications"
          aria-label="การแจ้งเตือน"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <Bell className="size-4.5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-white ring-2 ring-sidebar">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>

      <div className="-mt-3 space-y-5 px-4 pb-4">
        <MobileCheckinCard />

        {mine && (
          <>
            {/* Broken down by leave type — a single summed number reads as
                far larger than what's actually left to take, since sick/
                personal quotas would otherwise get silently folded in. */}
            <Link href="/leave" className="block rounded-xl bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <CalendarDays className="size-4" />
                </span>
                <p className="text-xs text-muted-foreground">วันลาคงเหลือ</p>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                {mine.leaveBalances.map((b) => (
                  <div key={b.type}>
                    <p className="text-base font-bold text-foreground">{b.remaining}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{b.label}</p>
                  </div>
                ))}
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-3">
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
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Star className="size-4" />
                </span>
                <p className="mt-2 text-xs text-muted-foreground">คะแนนให้กำลังใจ</p>
                <p className="mt-0.5 text-base font-bold text-foreground">
                  {mine.recognition.star + mine.recognition.award + mine.recognition.heart}
                </p>
              </div>
            </div>
          </>
        )}

        {nextPending && (
          <div className="rounded-xl bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ClipboardCheck className="size-4" />
                </span>
                <p className="text-xs text-muted-foreground">การประเมิน</p>
              </div>
              {pendingCount > 1 && (
                <Link href="/performance" className="flex items-center gap-0.5 text-xs font-medium text-primary">
                  ดูทั้งหมด <ChevronRight className="size-3.5" />
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{nextPending.campaignName}</p>
            <p className="text-xs text-muted-foreground">
              {nextPending.cycle}
              {nextPending.totalQuestions > 0 ? ` · ${nextPending.totalQuestions} หัวข้อ` : ""}
            </p>
            <Link
              href={`/performance/campaigns/${nextPending.campaignId}/participants/${nextPending.participantId}`}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              เริ่มประเมิน
            </Link>
          </div>
        )}

        {latestNotif && (
          <Link href="/notifications" className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm active:bg-muted">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">แจ้งเตือนล่าสุด</p>
              <p className="truncate text-sm font-medium text-foreground">
                {latestNotif.title} · {formatRelativeTime(latestNotif.createdAt)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <MobileMenuTileGrid groups={groups} hrStartIndex={hrStartIndex} />
      </div>
    </div>
  );
}
