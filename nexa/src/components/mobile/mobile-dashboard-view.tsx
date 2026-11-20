"use client";

import { useMenuVisibility } from "./use-menu-visibility";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock,
  HandHeart,
  LayoutGrid,
  ScanLine,
  Timer,
  TreePalm,
} from "lucide-react";
import { useNotifications } from "@/features/notification/hooks";
import { useEmployeeEvaluationHistory } from "@/features/campaign/hooks";
import { useMyPendingAppraisalTasks } from "@/features/appraisal-round/hooks";
import { useAuth } from "@/features/auth/auth-context";
import type { DashboardActions } from "@/features/dashboard/service";
import { MobileCheckinCard } from "./mobile-checkin-card";
import { MobileBell } from "./mobile-header";

/** What an employee does most often, rows of four (the last slot is "ทั้งหมด", the full menu). Each item only shows if the account may use it. */
/** `id` matches the menu ids in config/mobile-menu.ts, so hiding a menu in "ตั้งค่าเมนู" hides it here too. */
const QUICK_MENU = [
  { id: "leave", href: "/leave/new", label: "ขอลา", icon: TreePalm, permission: "leave:read" },
  { id: "overtime", href: "/overtime/new", label: "ขอ OT", icon: Timer, permission: "overtime:read" },
  // The attendance page lists the last 30 days of scans, with each day's in and out times.
  { id: "checkin", href: "/attendance", label: "ประวัติเข้า-ออกงาน", icon: ScanLine, permission: "attendance:read" },
  { id: "timeedit", href: "/attendance/corrections/new", label: "แก้เวลา", icon: Clock, permission: "attendance:create" },
  { id: "benefits", href: "/benefits/medical/new", label: "เบิกค่ารักษา", icon: HandHeart, permission: "expense:read" },
  { id: "shift", href: "/shifts", label: "ตารางกะ", icon: CalendarClock, permission: "shift:read" },
  { id: "calendar", href: "/calendar", label: "ปฏิทิน", icon: CalendarDays, permission: "calendar:read" },
] as const;

export interface MobileDashboardSnapshot {
  clockInAt: string | null;
  clockOutAt: string | null;
  leaveBalances: { type: string; label: string; remaining: number; configured: boolean }[];
  latestPayslip: { net: number; periodLabel: string } | null;
  recognition: { star: number; award: number; heart: number; point: number };
}

/** Bangkok wall-clock hour: the server renders in UTC, so getHours() disagreed with the browser and caused a hydration mismatch. */
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(new Date()));
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
 * still reachable from "บริการ" / other tabs — none of it lives on this
 * page, so nothing here removes an existing route.
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
  const { isVisible: isMenuVisible } = useMenuVisibility();
  const { data: notifData } = useNotifications();
  const hrNotifCount = notifData?.data?.items.filter((n) => !n.read && n.category === "hr").length ?? 0;

  const { items: pending, isLoading: evalLoading } = useMyPendingAppraisalTasks();
  const pendingCount = pending.length;
  const nextPending = pending[0] ?? null;

  const canViewEvalHistory = can("campaign:read");
  const { data: evalHistory, isLoading: scoreLoading } = useEmployeeEvaluationHistory(
    canViewEvalHistory ? user.employee?.id : undefined,
  );
  const latestEval = evalHistory?.data?.[0];
  const latestScore = latestEval ? latestEval.calibratedScore ?? latestEval.overallScore : null;

  const today = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
  const greetName = user.employee ? `คุณ${user.employee.firstName}` : name ?? "";

  // Sick, personal and annual leave are not interchangeable, so each type is shown on its own
  // (a single summed number reads as far more than anyone can actually take).
  const ORDER = ["SICK", "PERSONAL", "ANNUAL"];
  const leaveByType = mine
    ? [...mine.leaveBalances].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    : [];
  // What waits for this person's decision (team leave, OT, time corrections, claims, workflows).
  const toApprove = Object.values(actions.approvals).reduce((sum, n) => sum + n, 0);
  const hasTodo = toApprove > 0 || actions.myPending > 0 || pendingCount > 0 || hrNotifCount > 0;

  return (
    <div className="gv-m gv-lg-bg min-h-full md:hidden">
      <h1 className="sr-only">หน้าหลัก</h1>
      {/* Header: the blue Favpo band with the greeting; the status card below is the one high-emphasis surface on the page. */}
      <div className="mb-4 flex items-start justify-between gap-3 bg-[#0d47a1] px-4 pt-4 pb-5 text-white dark:bg-[#0a2f6b]">
        <div className="min-w-0">
          <p className="text-xl font-bold">GV One</p>
          <p className="mt-2 truncate text-lg font-medium">
            {greeting()} {greetName}
          </p>
          <p className="mt-0.5 text-sm text-white/85">วันนี้ {today}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MobileBell />
        </div>
      </div>

      <div className="space-y-5 px-4 pb-4">
        {/* Attendance Status Card + "เวลาวันนี้" 3-up summary */}
        <MobileCheckinCard />

        {/* ต้องทำวันนี้ */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold text-foreground">ต้องทำวันนี้</h2>
          {evalLoading ? (
            <div className="h-20 animate-pulse gv-lg-card" />
          ) : !hasTodo ? (
            <div className="flex items-center gap-2.5 gv-lg-card p-3.5 text-muted-foreground">
              <CheckCircle2 className="size-5 shrink-0 text-icon-chip-fg" strokeWidth={3} />
              <p className="text-sm">ไม่มีรายการที่ต้องทำวันนี้</p>
            </div>
          ) : (
            <div className="divide-y divide-gv-border overflow-hidden gv-lg-card">
              {toApprove > 0 && (
                <Link href="/requests?view=approvals" className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60">
                  <TodoIcon count={toApprove}>
                    <ClipboardCheck className="size-7" />
                  </TodoIcon>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">รอคุณอนุมัติ</p>
                    <p className="text-xs text-muted-foreground">{toApprove} รายการ</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {actions.myPending > 0 && (
                <Link href="/requests" className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60">
                  <TodoIcon count={actions.myPending}>
                    <ClipboardList className="size-7" />
                  </TodoIcon>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">คำขอของฉันที่รออนุมัติ</p>
                    <p className="text-xs text-muted-foreground">{actions.myPending} รายการ</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {pendingCount > 0 && (
                <Link
                  href={
                    pendingCount === 1 && nextPending ? `/appraisal/tasks/${nextPending.id}` : "/appraisal/tasks"
                  }
                  className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60"
                >
                  <TodoIcon count={pendingCount}>
                    <ClipboardPen className="size-7" />
                  </TodoIcon>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">มีการประเมินที่ต้องทำ</p>
                    <p className="text-xs text-muted-foreground">{pendingCount} รายการ</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}
              {hrNotifCount > 0 && (
                <Link href="/notifications" className="flex items-center gap-3 p-3.5 active:bg-icon-chip-bg/60">
                  <TodoIcon count={hrNotifCount}>
                    <Bell className="size-7" />
                  </TodoIcon>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">แจ้งเตือนจากหัวหน้า/HR</p>
                    <p className="text-xs text-muted-foreground">{hrNotifCount} รายการ</p>
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
          <div className="gv-lg-card grid grid-cols-4 gap-x-1.5 gap-y-3 p-3">
            {[...QUICK_MENU.filter((item) => can(item.permission) && isMenuVisible(item.id)), { id: "all", href: "/services", label: "ทั้งหมด", icon: LayoutGrid, permission: "" }].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 flex-col items-center gap-1.5 rounded-md text-center active:scale-95"
              >
                <span className="gv-lg-tile flex size-[58px] items-center justify-center rounded-md text-primary">
                  <item.icon className="size-7" />
                </span>
                <span className="text-xs leading-snug font-semibold text-foreground">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* สรุปของฉัน */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-bold text-foreground">สรุปของฉัน</h2>
          <Link href="/leave" className="block active:scale-[0.99]">
            <div className="gv-lg-card p-3">
              <p className="text-xs text-muted-foreground">วันลาคงเหลือ</p>
              {leaveByType.length === 0 ? (
                <p className="mt-1 text-sm font-bold text-foreground">—</p>
              ) : (
                <dl className="mt-1 grid grid-cols-3 gap-2">
                  {leaveByType.map((b) => (
                    <div key={b.type} className="min-w-0">
                      <dt className="truncate text-xs text-muted-foreground">{b.label}</dt>
                      <dd className="text-lg font-bold tabular-nums text-foreground">
                        {b.configured ? b.remaining : "—"}
                        {b.configured && <span className="text-xs font-medium text-muted-foreground"> วัน</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <SummaryTile href="/requests" icon={ClipboardList} label="คำขอของฉัน" value={`${actions.myTotal} รายการ`} />
            <SummaryTile
              href={user.employee ? `/employees/${user.employee.id}/evaluation-history` : "/performance"}
              icon={BarChart3}
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

/** Each "ต้องทำวันนี้" row gets its own fixed-art icon (menu-icons.md) — a
 * plain wrapper around whatever's passed in, since the three call sites mix
 * illustrated icons (fixed size prop) and the one lucide bell (className). */
function TodoIcon({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center text-primary">
      {children}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-bold text-badge-foreground ring-2 ring-card">
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
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const inner = (
    <div className="flex h-full flex-col gap-1.5 gv-lg-card p-3">
      <span className="flex size-8 items-center justify-center text-primary">
        <Icon size={26} />
      </span>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
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
