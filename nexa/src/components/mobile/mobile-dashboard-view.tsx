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
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { useNotifications } from "@/features/notification/hooks";
import { useMyPendingResponses, useEmployeeEvaluationHistory } from "@/features/campaign/hooks";
import { useAuth } from "@/features/auth/auth-context";
import type { DashboardActions } from "@/features/dashboard/service";
import { MobileCheckinCard } from "./mobile-checkin-card";

export interface MobileDashboardSnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveBalances: { type: string; label: string; remaining: number }[];
  latestPayslip: { net: number; periodLabel: string } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

/**
 * Mobile Home tab — redesigned per the 2026-08 spec: a light header (name/
 * greeting/date + notification bell + profile), the Attendance Status Card
 * as the single most prominent element (MobileCheckinCard — also renders
 * the "เวลาวันนี้" 3-up summary), a "ต้องทำวันนี้" action card surfacing real
 * pending counts, a trimmed 3-item quick menu (เข้า/ออกงาน dropped — it's
 * already the Attendance Card's job), and a compact "สรุปของฉัน" stat row.
 * The full categorized quick-menu (services grid) and the rest of the app's
 * functionality (นัดประชุม, AI Assistant, HR menu, etc.) are unchanged and
 * still reachable from the bottom nav's profile drawer / other tabs — none
 * of it lives on this page, so nothing here removes an existing route.
 */
export function MobileDashboardView({
  name,
  mine,
  actions,
}: {
  name?: string | null;
  mine: MobileDashboardSnapshot | null;
  actions: DashboardActions;
}) {
  const { user, can } = useAuth();
  const { data: notifData } = useNotifications();
  const unreadCount = notifData?.data?.unread ?? 0;

  const { data: pendingData, isLoading: evalLoading } = useMyPendingResponses();
  const pending = pendingData?.data ?? [];
  const pendingCount = pending.length;
  const nextPending = pending[0] ?? null;

  const canViewEvalHistory = can("campaign:read");
  const { data: evalHistory, isLoading: scoreLoading } = useEmployeeEvaluationHistory(
    canViewEvalHistory ? user.employee?.id : undefined,
  );
  const latestEval = evalHistory?.data?.[0];
  const latestScore = latestEval ? latestEval.calibratedScore ?? latestEval.overallScore : null;

  const today = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
  const greetName = user.employee ? `คุณ${user.employee.firstName}` : name ?? "";

  const leaveRemaining = mine ? mine.leaveBalances.reduce((sum, b) => sum + b.remaining, 0) : null;
  const hasTodo = actions.myPending > 0 || pendingCount > 0;

  return (
    <div className="min-h-full bg-gv-bg md:hidden">
      {/* Header — plain background, no dark card here: the Attendance Card
          below is deliberately the only high-emphasis surface on the page. */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gv-dark-green">GV ONE HR</p>
          <p className="mt-1 truncate text-lg font-semibold text-foreground">
            {greeting()} {greetName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">วันนี้ {today}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/notifications"
            className="relative flex size-10 items-center justify-center rounded-full bg-card text-icon-chip-fg shadow-sm active:scale-95"
            aria-label="แจ้งเตือน"
          >
            <Bell className="size-[18px]" strokeWidth={2.5} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-bold text-badge-foreground ring-2 ring-gv-bg">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className="flex size-10 items-center justify-center rounded-full bg-card text-icon-chip-fg shadow-sm active:scale-95"
            aria-label="โปรไฟล์"
          >
            <UserRound className="size-[18px]" strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      <div className="space-y-5 px-4 pb-4">
        {/* Attendance Status Card + "เวลาวันนี้" 3-up summary */}
        <MobileCheckinCard />

        {/* ต้องทำวันนี้ */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold text-foreground">ต้องทำวันนี้</h2>
          {evalLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-card" />
          ) : !hasTodo ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-card p-3.5 text-muted-foreground shadow-sm">
              <CheckCircle2 className="size-5 shrink-0 text-icon-chip-fg" strokeWidth={2.5} />
              <p className="text-sm">ไม่มีรายการที่ต้องทำวันนี้</p>
            </div>
          ) : (
            <div className="divide-y divide-gv-border overflow-hidden rounded-2xl bg-card shadow-sm">
              {actions.myPending > 0 && (
                <Link href="/requests" className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60">
                  <TodoIcon icon={FilePlus2} count={actions.myPending} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">มีคำขอรออนุมัติ</p>
                    <p className="text-xs text-muted-foreground">{actions.myPending} รายการ</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {pendingCount > 0 && (
                <Link
                  href={
                    pendingCount === 1 && nextPending
                      ? `/performance/campaigns/${nextPending.campaignId}/participants/${nextPending.participantId}`
                      : "/performance"
                  }
                  className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60"
                >
                  <TodoIcon icon={Star} count={pendingCount} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">มีการประเมินที่ต้องทำ</p>
                    <p className="text-xs text-muted-foreground">{pendingCount} รายการ</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
            </div>
          )}
        </section>

        {/* เมนูด่วน — "เข้า/ออกงาน" intentionally left out, it's the
            Attendance Card above; the full categorized menu lives in the
            profile drawer, unchanged. */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold text-foreground">เมนูด่วน</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: "/leave/new", label: "ขอลา", icon: FilePlus2 },
              { href: "/overtime/new", label: "ขอ OT", icon: Timer },
              { href: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center shadow-sm active:scale-95 active:bg-icon-chip-bg/60"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-icon-chip-bg text-icon-chip-fg">
                  <item.icon className="size-5" strokeWidth={2.5} />
                </span>
                <span className="text-[12px] font-medium text-foreground">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* สรุปของฉัน */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold text-foreground">สรุปของฉัน</h2>
          <div className="grid grid-cols-3 gap-2">
            <SummaryTile
              href="/leave"
              icon={CalendarDays}
              label="วันลาคงเหลือ"
              value={leaveRemaining != null ? `${leaveRemaining} วัน` : "—"}
            />
            <SummaryTile href="/requests" icon={ClipboardList} label="คำขอของฉัน" value={`${actions.myTotal} รายการ`} />
            <SummaryTile
              href={user.employee ? `/employees/${user.employee.id}/evaluation-history` : "/performance"}
              icon={Star}
              label="คะแนนการประเมิน"
              value={scoreLoading ? "…" : latestScore != null ? `${latestScore.toFixed(1)} / 5` : "—"}
              disabled={!canViewEvalHistory}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function TodoIcon({ icon: Icon, count }: { icon: typeof ClipboardCheck; count: number }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-icon-chip-bg text-icon-chip-fg">
      <Icon className="size-[18px]" strokeWidth={2.5} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-bold text-badge-foreground ring-2 ring-card">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}

function SummaryTile({
  href,
  icon: Icon,
  label,
  value,
  disabled,
}: {
  href: string;
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className="flex h-full flex-col gap-1.5 rounded-2xl bg-card p-3 shadow-sm">
      <span className="flex size-7 items-center justify-center rounded-full bg-icon-chip-bg text-icon-chip-fg">
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
  if (disabled) return inner;
  return (
    <Link href={href} className="active:scale-95">
      {inner}
    </Link>
  );
}
