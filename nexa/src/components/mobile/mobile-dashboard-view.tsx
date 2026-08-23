"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Star,
  ClipboardCheck,
  ChevronRight,
  FilePlus2,
  Timer,
  CalendarPlus,
} from "lucide-react";
import { useNotifications } from "@/features/notification/hooks";
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { formatRelativeTime } from "@/lib/format";
import { MobileCheckinCard } from "./mobile-checkin-card";

export interface MobileDashboardSnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveBalances: { type: string; label: string; remaining: number }[];
  latestPayslip: { net: number; periodLabel: string } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

/**
 * Mobile Home tab — brand/name/role/date header (no hamburger, no bell per
 * the redesign spec), the live check-in/out action (MobileCheckinCard, the
 * mobile-only redesign of the desktop ClockCard), "หมวดงานประจำวัน" quick
 * links, and "หมวดติดตามของฉัน" personal status cards. The full categorized
 * quick-menu (same groups as "บริการ"/`/services`) now lives in the bottom
 * nav's profile drawer instead of being duplicated here. No AI surface here
 * — mobile is intentionally AI-free for employees.
 */
export function MobileDashboardView({
  name,
  mine,
}: {
  name?: string | null;
  mine: MobileDashboardSnapshot | null;
}) {
  const { user } = useAuth();
  const { data: notifData } = useNotifications();
  const latestNotif = notifData?.data?.items?.[0] ?? null;
  const { data: pendingData } = useMyPendingResponses();
  const pending = pendingData?.data ?? [];
  const pendingCount = pending.length;
  const nextPending = pending[0] ?? null;

  const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date());
  const roleLabel = user.roles.join(", ") || "พนักงาน";

  return (
    <div className="min-h-full bg-muted md:hidden">
      {/* Header: brand + name + role + date only — no hamburger, no bell
          (notifications live in the profile drawer's quick-link instead). */}
      <div className="rounded-b-3xl bg-sidebar px-4 pt-4 pb-5 text-white">
        <p className="text-xs font-bold tracking-wide text-primary">GV ONE HR</p>
        <p className="mt-1.5 text-base font-semibold text-white">{name}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-300">
          <span>{roleLabel}</span>
          <span className="text-slate-500">·</span>
          <span>{today}</span>
        </div>
      </div>

      <div className="space-y-5 px-4 pt-4 pb-4">
        <MobileCheckinCard />

        {/* หมวดงานประจำวัน */}
        <section>
          <h2 className="mb-2 px-1 text-[13px] font-bold text-foreground">หมวดงานประจำวัน</h2>
          <div className="grid grid-cols-4 gap-x-1 gap-y-2 rounded-2xl bg-card p-3 shadow-sm">
            {[
              { href: "/attendance", label: "เข้างาน/ออกงาน", icon: ClipboardCheck },
              { href: "/leave/new", label: "ขอลา", icon: FilePlus2 },
              { href: "/overtime/new", label: "ขอ OT", icon: Timer },
              { href: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 text-center active:scale-95 active:bg-muted"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-icon-chip-bg text-icon-chip-fg">
                  <item.icon className="size-[18px]" />
                </span>
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* หมวดติดตามของฉัน */}
        <section className="space-y-3">
          <h2 className="px-1 text-[13px] font-bold text-foreground">หมวดติดตามของฉัน</h2>

          {mine && (
            <>
              {/* Broken down by leave type — a single summed number reads as
                  far larger than what's actually left to take, since sick/
                  personal quotas would otherwise get silently folded in. */}
              <Link href="/leave" className="block rounded-xl bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
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
                <Link href="/requests" className="rounded-xl bg-card p-3.5 shadow-sm">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
                    <ClipboardList className="size-4" />
                  </span>
                  <p className="mt-2 text-xs text-muted-foreground">คำขอของฉัน</p>
                  <p className="mt-0.5 text-base font-bold text-foreground">ลา / OT / แก้เวลา</p>
                </Link>
                <div className="rounded-xl bg-card p-3.5 shadow-sm">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
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
                  <span className="flex size-7 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
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

          <Link href="/meetings" className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm active:bg-muted">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
              <CalendarPlus className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">นัดประชุม</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>

          {latestNotif && (
            <Link href="/notifications" className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm active:bg-muted">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-icon-chip-bg text-icon-chip-fg">
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
        </section>
      </div>
    </div>
  );
}
