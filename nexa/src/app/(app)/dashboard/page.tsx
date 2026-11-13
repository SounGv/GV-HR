import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { MobileDashboardView } from "@/components/mobile/mobile-dashboard-view";
import { ArrowUp, ArrowUpRight, CalendarDays, CircleCheck, CircleX, Clock, Sparkles, TriangleAlert, Users, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/rbac";
import {
  getDashboardSummary,
  getActionCenter,
  getMySnapshot,
  getAttendanceTrend,
  getDepartmentWatchlist,
  type LeaveBalanceSummary,
} from "@/features/dashboard/service";
import { ActionCenter } from "@/features/dashboard/action-center";
import { MeetingsTodaySection, MissedScanOutSection, OvertimeTodaySection } from "@/features/dashboard-daily/daily-sections";
import {
  loadAttendanceWatchCached,
  loadTodayAttendance,
  listDepartmentOptions,
} from "@/features/attendance-status/service";
import {
  LiveDepartmentBreakdown,
  LiveFollowRows,
  LiveHero,
  LiveStamp,
  LiveTodayProvider,
} from "@/features/attendance-status/live-today";
import { FollowRowLoading } from "@/features/dashboard/follow-up";
import { SectionHeading } from "@/components/shared/section-heading";
import { CountUp } from "@/components/shared/count-up";
import { DepartmentWatchCard, WatchlistCard } from "@/features/attendance-status/attendance-watch-sections";
import { DepartmentFilter } from "@/features/attendance-status/department-filter";
import {
  EvaluationProgressSection,
  ProbationDueSection,
  UpcomingLeavesSection,
} from "@/features/dashboard-people/people-sections";
import type { AccessClaims } from "@/lib/auth/jwt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceRateLine } from "@/features/dashboard/dashboard-charts-lazy";
import { KpiMiniBars } from "@/features/dashboard/kpi-mini-bars";
import { TeamOverview } from "@/features/dashboard/team-overview";
import { groupTopDepartments } from "@/features/dashboard/group-departments";
import { loginIdentifier, displayName } from "@/lib/format";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import type { EmploymentType } from "@/features/employee/types";
import { cn } from "@/lib/utils";
import { LeaveIcon, StarIllustrationIcon } from "@/components/shared/illustrated-icons";
import { CheckInIcon } from "@/components/shared/menu-icons";
import type { MenuIcon } from "@/config/mobile-menu";

export const metadata: Metadata = { title: "หน้าหลัก" };

/** Day-over-day change badge (dashboard-fix-3) — colored by what the change
 * MEANS for that metric, not by raw direction: more people present is good,
 * more people late is not, so the same "▲" can be green on one card and
 * amber on another. `goodDirection: "neutral"` (leave/OT — no HR-agreed
 * "more is better/worse" rule for those) always renders the neutral grey. */
function TrendBadge({
  data,
  goodDirection,
}: {
  data: { value: number }[];
  goodDirection: "up" | "down" | "neutral";
}) {
  if (data.length < 2) return null;
  const today = data[data.length - 1].value;
  const prev = data[data.length - 2].value;
  const diff = today - prev;
  if (diff === 0) {
    return <span className="text-xs font-medium text-muted-foreground">เท่าเดิม</span>;
  }
  const isUp = diff > 0;
  const isGood = goodDirection === "neutral" ? null : goodDirection === "up" ? isUp : !isUp;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        isGood === null ? "text-muted-foreground" : isGood ? "text-success" : "text-warning",
      )}
    >
      {isUp ? "▲" : "▼"} {Math.abs(diff)} จากวันก่อน
    </span>
  );
}

/** KPI card — a small color dot instead of an icon chip (N mockup spec):
 * reads as a quick categorical key at a glance across the whole row.
 * `miniBars` (dashboard-fix-3) replaces the old flat-line Sparkline with
 * per-day bars plus a day-over-day change badge; `footer` is for the one
 * card (headcount) that shows something else entirely instead. */
function Kpi({
  label,
  value,
  unit,
  color,
  sub,
  miniBars,
  footer,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  sub?: ReactNode;
  miniBars?: {
    data: { label: string; value: number }[];
    unit?: string;
    emptyLabel?: string;
    goodDirection: "up" | "down" | "neutral";
  };
  footer?: ReactNode;
}) {
  return (
    <Card className="gv-lift gap-0 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {miniBars && <TrendBadge data={miniBars.data} goodDirection={miniBars.goodDirection} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
      {miniBars && (
        <div className="mt-2">
          <KpiMiniBars data={miniBars.data} color={color} unit={miniBars.unit} emptyLabel={miniBars.emptyLabel} />
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </Card>
  );
}

/** Remaining leave shown per type (พักร้อน/ป่วย/กิจ) — a single summed number across
 * every leave type reads as far larger than what an employee actually has left to
 * take, since sick/personal quotas get silently folded into it. */
function LeaveBalanceTile({ balances, href }: { balances: LeaveBalanceSummary[]; href: string }) {
  return (
    <Link href={href}>
      <Card className="gv-lift gap-0 p-4">
        <div className="flex items-center gap-2">
          <LeaveIcon size={32} />
          <span className="truncate text-xs text-muted-foreground">วันลาคงเหลือ</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          {balances.map((b) => (
            <div key={b.type}>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {b.configured ? b.remaining : "-"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{b.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </Link>
  );
}

function MyTile({
  label,
  value,
  sub,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: MenuIcon;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="gv-lift gap-0 p-4">
        <div className="flex items-center gap-2">
          <Icon size={32} />
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 truncate text-lg font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

/** One cell of the "14 วันทำการล่าสุด" strip: one card split by dividers (dashboard-v3-mock.html). */
function StripCell({
  icon: Icon,
  label,
  value,
  decimals = 0,
  unit,
  sub,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  decimals?: number;
  unit: string;
  sub?: ReactNode;
}) {
  return (
    <div className="border-border px-[18px] py-3.5 not-first:border-l max-lg:[&:nth-child(4)]:border-l-0 max-lg:[&:nth-child(n+4)]:border-t">
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" /> {label}
      </p>
      <p className="mt-0.5 text-[22px] leading-tight font-bold tabular-nums">
        <CountUp value={value} decimals={decimals} /> <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </p>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Bangkok wall-clock hour: the server runs in UTC, so getHours() alone greeted people with the wrong part of the day. */
function bangkokHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(new Date()));
}

/** e.g. "วันพุธที่ 11 พฤศจิกายน 2569" (Buddhist year, Bangkok date). */
function todayLabel(): string {
  return new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" })
    .format(new Date());
}

function greeting(): string {
  const h = bangkokHour();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}


async function AttendanceWatchSection({
  companyId,
  session,
  departmentIds,
}: {
  companyId: string;
  session: AccessClaims;
  departmentIds: string[];
}) {
  let watch;
  try {
    watch = await loadAttendanceWatchCached(companyId, session, departmentIds);
  } catch {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          โหลดรายชื่อที่ควรติดตามไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <WatchlistCard data={watch} departmentIds={departmentIds} />
      {departmentIds.length === 0 && <DepartmentWatchCard data={watch} />}
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await getCurrentUser();
  const { dept } = await searchParams;
  // Sequential, not Promise.all — connection_limit=1.
  const s = await getDashboardSummary(user!.companyId);
  const actions = await getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles, user!.permissions);
  const canSeePay = can(user!.permissions, "payroll:create") || can(user!.permissions, "payroll:approve");
  const mine = user!.employee ? await getMySnapshot(user!.companyId, user!.employee.id, canSeePay) : null;
  const canSeeAttendance = can(user!.permissions, "attendance:approve") || can(user!.permissions, "attendance:manage");
  // Company-wide numbers (who is late, which departments, headcount) are for HR,
  // managers and finance, not for every employee (owner's decision, 2026-11-13).
  const canSeeCompany = canSeeAttendance || can(user!.permissions, "report:read");
  const attendanceTrend = canSeeCompany ? await getAttendanceTrend(user!.companyId) : [];
  // The old per-department watch list is only shown to people who do not get the new attendance section.
  const departmentWatchlist = canSeeAttendance || !canSeeCompany ? [] : await getDepartmentWatchlist(user!.companyId);

  // Attendance overview (who is in, late, absent, on leave) — only for people
  // who can approve or manage attendance, and the server narrows it to their own
  // team unless they are company-wide. Without the permission nothing is read.
  const deptIds = dept && UUID_RE.test(dept) ? [dept] : [];
  const session = {
    sub: user!.id,
    companyId: user!.companyId,
    email: user!.email ?? null,
    username: user!.username ?? null,
    roles: user!.roles,
    perms: user!.permissions,
    employeeId: user!.employee?.id,
  };
  // People cards: each is read only for people with the matching permission, and
  // the data layer narrows them to the caller's own team unless company-wide.
  // approve = HR company-wide, manage = a manager's own team (the rows narrow to the team); same check as the sidebar badge.
  const canSeeLeaves = can(user!.permissions, "leave:approve") || can(user!.permissions, "leave:manage");
  const canSeeProbation = can(user!.permissions, "employee:update") || can(user!.permissions, "leave:approve");
  const canSeeEvaluation =
    can(user!.permissions, "campaign:manage") ||
    can(user!.permissions, "campaign:update") ||
    can(user!.permissions, "campaign:approve");
  const canSeeOvertime = can(user!.permissions, "overtime:approve") || can(user!.permissions, "overtime:manage");
  const canSeeMeetings = can(user!.permissions, "meeting:read");
  const showFollow = canSeeAttendance || canSeeOvertime || canSeeMeetings || canSeeLeaves || canSeeProbation || canSeeEvaluation;
  const attendanceToday = canSeeAttendance ? await loadTodayAttendance(user!.companyId, session, deptIds) : null;
  const departmentOptions = canSeeAttendance ? await listDepartmentOptions(user!.companyId) : [];

  const name = user?.employee ? displayName(user.employee) : loginIdentifier(user ?? {});
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;
  const departmentRanked = groupTopDepartments(s.byDepartment);
  const employmentTypes = s.byEmploymentType
    .map((r) => ({
      type: r.type,
      label: EMPLOYMENT_LABEL[r.type as EmploymentType] ?? r.type,
      count: r.count,
      pct: s.headcount > 0 ? Math.round((r.count / s.headcount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const avgAttendanceRate =
    attendanceTrend.length > 0
      ? Math.round(
          attendanceTrend.reduce((sum, d) => {
            const total = d.present + d.leave + d.absent || 1;
            return sum + (d.present / total) * 100;
          }, 0) / attendanceTrend.length,
        )
      : 0;
  const lateSum = attendanceTrend.reduce((sum, d) => sum + d.late, 0);
  const leaveSum = attendanceTrend.reduce((sum, d) => sum + d.leave, 0);
  const absentSum = attendanceTrend.reduce((sum, d) => sum + d.absent, 0);
  // Display-only re-sort (dashboard-fix-3): lateness is the real actionable
  // signal, a missing clock-in is often just an unlogged record — leaves the
  // watchlist query/service untouched, just changes the order shown here.
  const pendingApprovals = Object.values(actions.approvals).reduce((sum, n) => sum + n, 0);
  const departmentWatchlistRanked = [...departmentWatchlist].sort(
    (a, b) => b.late - a.late || b.absent - a.absent,
  );

  return (
    <>
      <MobileDashboardView name={name} mine={mine} actions={actions} />
      <LiveTodayProvider initial={attendanceToday} departmentIds={deptIds}>
      <div className="theme-flip7 gv-page-band hidden space-y-6 md:-mx-6 md:-mt-6 md:block md:px-6 md:pt-6">
      {/* Greeting, date and the page-wide controls on one row. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-[22px] leading-snug font-bold">
              {greeting()}, {name}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {todayLabel()} · {user?.company?.name}
            </p>
          </div>
        </div>
        {attendanceToday && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <LiveStamp />
            <DepartmentFilter departments={departmentOptions} selected={deptIds[0] ?? null} />
          </div>
        )}
      </div>

      {/* AI: one-line summary plus an ask box that opens the AI page with the question. */}
      {canSeeCompany && (
      <section
        aria-label="สรุปวันนี้"
        className="grid items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-3 pr-3.5 shadow-[var(--card-shadow)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(280px,420px)]"
      >
        {/* น้องวีบอท appears once per screen (the sidebar's AI shortcut); here a sparkle marks the AI summary. */}
        <span className="hidden size-10 items-center justify-center rounded-xl bg-[#f0fdfa] text-[#0d9488] ring-1 ring-[#ccfbf1] ring-inset lg:flex">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <p className="text-[13.5px] leading-relaxed">
          <span className="block text-xs font-semibold text-[var(--flip7-teal-dark)]">สรุปวันนี้</span>
          {/* Same base as the attendance card beside it (people who use the check-in app),
              so the two never disagree (it used to say 34% here and 100% there). */}
          {attendanceToday && attendanceToday.total > 0 ? (
            <>
              สแกนเข้างาน <b className="tabular-nums">{attendanceToday.scanned}</b> จาก{" "}
              <b className="tabular-nums">{attendanceToday.total}</b> คน (
              {Math.round((attendanceToday.scanned / attendanceToday.total) * 100)}%) · มาสาย{" "}
              <b className="tabular-nums">{attendanceToday.counts.LATE}</b> คน · ลา{" "}
              <b className="tabular-nums">{attendanceToday.counts.ON_LEAVE}</b> คน
            </>
          ) : (
            <>
              เข้างาน <b className="tabular-nums">{s.presentToday}</b> คน ({s.attendanceRate}%) · มาสาย{" "}
              <b className="tabular-nums">{s.lateToday}</b> คน · ลา <b className="tabular-nums">{s.onLeaveToday}</b> คน
            </>
          )}
          {pendingApprovals > 0 && (
            <>
              {" "}
              · รอคุณอนุมัติ <b className="tabular-nums">{pendingApprovals}</b> รายการ
            </>
          )}
        </p>
        <form action="/ai" className="flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-[#cfd6dc] bg-card pr-1 pl-3 transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
          <input
            name="q"
            required
            maxLength={500}
            aria-label="ถาม AI Assistant"
            placeholder="ถาม AI เช่น ใครมาสายเกิน 3 ครั้งเดือนนี้"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="ส่งคำถาม"
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--flip7-teal-dark)] text-white transition-colors hover:bg-[#115e59]"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} />
          </button>
        </form>
      </section>
      )}

      {attendanceToday && <LiveHero />}

      {/* What needs following up today (left) and what waits for my approval (right). */}
      <div className={cn("grid items-start gap-[22px]", showFollow && "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}>
        {showFollow && (
          <section id="follow-up" aria-label="ต้องตามวันนี้" className="scroll-mt-24 space-y-3">
            <SectionHeading title="ต้องตามวันนี้" hint="เรียงจากเร่งด่วนที่สุด · กดแถวเพื่อดูรายชื่อ" />
            {/* Each row loads on its own; its order value keeps the most urgent on top whatever arrives first. */}
            <Card className="gv-rise @container gap-0 py-0 [&>*]:-mt-px" style={{ "--i": 2 } as React.CSSProperties}>
              {attendanceToday && <LiveFollowRows />}
              {canSeeAttendance && (
                <Suspense fallback={<FollowRowLoading order={3} />}>
                  <MissedScanOutSection companyId={user!.companyId} session={session} />
                </Suspense>
              )}
              {canSeeOvertime && (
                <Suspense fallback={<FollowRowLoading order={4} />}>
                  <OvertimeTodaySection companyId={user!.companyId} session={session} />
                </Suspense>
              )}
              {canSeeLeaves && (
                <Suspense fallback={<FollowRowLoading order={5} />}>
                  <UpcomingLeavesSection companyId={user!.companyId} session={session} />
                </Suspense>
              )}
              {canSeeProbation && (
                <Suspense fallback={<FollowRowLoading order={6} />}>
                  <ProbationDueSection companyId={user!.companyId} session={session} />
                </Suspense>
              )}
              {canSeeEvaluation && (
                <Suspense fallback={<FollowRowLoading order={7} />}>
                  <EvaluationProgressSection companyId={user!.companyId} session={session} />
                </Suspense>
              )}
              {canSeeMeetings && (
                <Suspense fallback={<FollowRowLoading order={8} />}>
                  <MeetingsTodaySection companyId={user!.companyId} employeeId={user!.employee?.id} />
                </Suspense>
              )}
            </Card>
          </section>
        )}

        <div className="space-y-[22px]">
          <section aria-label="รอคุณอนุมัติ" className="gv-rise space-y-3" style={{ "--i": 3 } as React.CSSProperties}>
            <SectionHeading title="รอคุณอนุมัติ" hint="คำขอที่ส่งมาถึงคุณ" />
            <ActionCenter data={actions} />
          </section>

          {/* My today — personal snapshot, not company aggregates. "เงินเดือนล่าสุด"
              deliberately left out for now — HR wants to focus rollout on
              attendance/leave and the evaluation system first. */}
          {mine && (
            <section className="space-y-3">
              <SectionHeading title="ของฉันวันนี้" hint="เวลาเข้างาน วันลา และคะแนนของคุณ" />
              <div className={cn("grid grid-cols-2 gap-3", !showFollow && "lg:grid-cols-3")}>
                <MyTile
                  icon={CheckInIcon}
                  label="เวลาเข้างานวันนี้"
                  value={fmtClock(mine.clockInAt) ?? "ยังไม่เช็คอิน"}
                  sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined}
                  href="/attendance"
                />
                <MyTile
                  icon={StarIllustrationIcon}
                  label="คะแนนให้กำลังใจ"
                  value={`${mine.recognition.star + mine.recognition.award + mine.recognition.heart}`}
                  sub={`+${mine.recognition.point} คะแนน`}
                  href="/attendance"
                />
                <div className={cn("col-span-2", !showFollow && "lg:col-span-1")}>
                  <LeaveBalanceTile balances={mine.leaveBalances} href="/leave" />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {attendanceToday && (
        <section aria-label="14 วันทำการล่าสุด" className="space-y-3">
          <SectionHeading title="14 วันทำการล่าสุด" hint="ยอดรวมจากการเข้างานย้อนหลัง และ OT ของวันนี้" />
          <Card className="grid grid-cols-3 gap-0 py-0 lg:grid-cols-6">
            <StripCell
              icon={Users}
              label="พนักงานทั้งหมด"
              value={s.headcount}
              unit="คน"
              sub={s.newThisMonth > 0 ? <span className="text-success">+{s.newThisMonth} เดือนนี้</span> : undefined}
            />
            <StripCell icon={CircleCheck} label="เข้างานเฉลี่ย" value={avgAttendanceRate} unit="%" />
            <StripCell icon={Clock} label="มาสายรวม" value={lateSum} unit="ครั้ง" />
            <StripCell icon={CalendarDays} label="ลารวม" value={leaveSum} unit="ครั้ง" />
            <StripCell icon={CircleX} label="ไม่มีบันทึกเวลา" value={absentSum} unit="คน-วัน" />
            <StripCell
              icon={Zap}
              label="OT วันนี้"
              value={s.otHoursToday}
              decimals={Number.isInteger(s.otHoursToday) ? 0 : 1}
              unit="ชม."
            />
          </Card>
        </section>
      )}

      {attendanceToday && (
        <section aria-label="แนวโน้มและรายแผนก" className="space-y-3">
          <SectionHeading title="แนวโน้มและรายแผนก" hint="คนที่มาสายหรือขาดบ่อยใน 30 วัน และแต่ละแผนกวันนี้" />
          {/* The 30-day watch list is the slowest part (it reads a month of attendance), so it streams in after the rest. */}
          <Suspense
            fallback={
              <Card>
                <CardContent className="py-4 text-sm text-muted-foreground">กำลังคำนวณรายชื่อที่ควรติดตาม…</CardContent>
              </Card>
            }
          >
            <AttendanceWatchSection companyId={user!.companyId} session={session} departmentIds={deptIds} />
          </Suspense>
          <LiveDepartmentBreakdown />
        </section>
      )}

      {/* KPI cards (today) — for people without the attendance view; the strip above covers the rest. */}
      {canSeeCompany && !attendanceToday && (
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="พนักงานทั้งหมด"
          value={s.headcount}
          unit="คน"
          color="var(--flip7-sky)"
          sub={
            s.newThisMonth > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-success">
                <ArrowUpRight className="size-3" /> +{s.newThisMonth} เดือนนี้
              </span>
            ) : (
              "องค์กร"
            )
          }
          footer={
            <div className="flex h-[6px] gap-[3px] overflow-hidden rounded-full">
              {employmentTypes.map((t) => (
                <div
                  key={t.type}
                  style={{ width: `${t.pct}%`, background: t.type === "DAILY_WORKER" ? "var(--flip7-gold)" : "var(--flip7-teal)" }}
                />
              ))}
            </div>
          }
        />
        <Kpi
          label="เข้างานวันนี้"
          value={s.presentToday}
          unit="คน"
          color="var(--series-present)"
          sub={`${s.attendanceRate}% ของพนักงาน`}
          miniBars={{
            data: attendanceTrend.map((p) => ({ label: p.label, value: p.present })),
            goodDirection: "up",
          }}
        />
        <Kpi
          label="มาสายวันนี้"
          value={s.lateToday}
          unit="คน"
          color="var(--series-late)"
          sub="ต้องติดตาม"
          miniBars={{
            data: attendanceTrend.map((p) => ({ label: p.label, value: p.late })),
            goodDirection: "down",
          }}
        />
        <Kpi
          label="ลาวันนี้"
          value={s.onLeaveToday}
          unit="คน"
          color="var(--series-leave)"
          sub="อนุมัติแล้ว"
          miniBars={{
            data: attendanceTrend.map((p) => ({ label: p.label, value: p.leave })),
            goodDirection: "neutral",
          }}
        />
        <Kpi
          label="OT วันนี้"
          value={s.otHoursToday}
          unit="ชม."
          color="var(--series-ot)"
          sub="รวมทั้งองค์กร"
          miniBars={{
            data: attendanceTrend.map((p) => ({ label: p.label, value: p.otHours })),
            unit: "ชม.",
            emptyLabel: "ไม่มี OT ใน 14 วันล่าสุด",
            goodDirection: "neutral",
          }}
        />
      </section>
      )}

      {/* Attendance rate line (dashboard-fix-3) — % of headcount per business
          day, plus a rolled-up summary alongside it. */}
      {canSeeCompany && (
      <Card>
        <CardHeader>
          <CardTitle>การเข้างาน 14 วันทำการล่าสุด</CardTitle>
          <p className="text-xs text-muted-foreground">อัตราเข้างาน/มาสาย/ลา ต่อวัน เทียบเป็น %</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <AttendanceRateLine data={attendanceTrend} />
            </div>
            {!attendanceToday && (
            <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:w-[220px] lg:grid-cols-1">
              <div className="gv-teal-surface flex flex-col rounded-2xl p-3">
                <span className="text-xs text-white/80">เข้างานเฉลี่ย</span>
                <span className="text-2xl font-bold text-white tabular-nums">{avgAttendanceRate}%</span>
              </div>
              <div className="flex flex-col rounded-2xl bg-surface-muted p-3">
                <span className="text-xs" style={{ color: "var(--series-late)" }}>มาสายรวม</span>
                <span className="text-xl font-bold tabular-nums">{lateSum} ครั้ง</span>
              </div>
              <div className="flex flex-col rounded-2xl bg-surface-muted p-3">
                <span className="text-xs" style={{ color: "var(--series-leave)" }}>ลารวม</span>
                <span className="text-xl font-bold tabular-nums">{leaveSum} ครั้ง</span>
              </div>
              <div className="flex flex-col rounded-2xl bg-surface-muted p-3">
                <span className="text-xs text-muted-foreground">ไม่มีบันทึกเวลา (คน-วัน)</span>
                <span className="text-xl font-bold tabular-nums">{absentSum}</span>
              </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Department watch list for people without the live attendance view. */}
        {canSeeCompany && !attendanceToday && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <TriangleAlert className="size-4" />
              </span>
              แผนกที่ควรติดตาม
            </CardTitle>
            <p className="text-xs text-muted-foreground">ขาดงานและมาสายสะสม 30 วัน</p>
          </CardHeader>
          <CardContent>
            {departmentWatchlistRanked.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีแผนกที่ต้องติดตามในช่วงนี้ 👍</p>
            ) : (
              <div className="flex flex-col gap-1">
                {departmentWatchlistRanked.map((w) => {
                  const max = Math.max(...departmentWatchlistRanked.map((r) => r.absent + r.late), 1);
                  return (
                    <div key={w.name} className="grid grid-cols-[140px_1fr_150px] items-center gap-3 rounded-xl p-2">
                      <span className="truncate text-sm font-medium">{w.name}</span>
                      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
                        <div style={{ width: `${(w.absent / max) * 100}%`, background: "var(--series-norecord)" }} />
                        <div style={{ width: `${(w.late / max) * 100}%`, background: "var(--series-late)" }} />
                      </div>
                      <span className="text-right text-xs text-muted-foreground tabular-nums">
                        ไม่มีบันทึก <b className="text-foreground">{w.absent}</b> สาย{" "}
                        <b style={{ color: "var(--series-late)" }}>{w.late}</b>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

      {/* ทีมงาน: who works here, by employment type and by department. */}
      {canSeeCompany && (
        <TeamOverview headcount={s.headcount} employmentTypes={employmentTypes} departments={departmentRanked} />
      )}
      </div>
      </LiveTodayProvider>
    </>
  );
}
