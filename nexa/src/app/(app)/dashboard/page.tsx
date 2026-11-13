import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { MobileDashboardView } from "@/components/mobile/mobile-dashboard-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/rbac";
import {
  getDashboardSummary,
  getActionCenter,
  getMySnapshot,
  type LeaveBalanceSummary,
} from "@/features/dashboard/service";
import { ActionCenter } from "@/features/dashboard/action-center";
import { MyEvaluationTasks } from "@/features/dashboard/my-evaluation-tasks";
import { MeetingsTodaySection, MissedScanOutSection, OvertimeTodaySection } from "@/features/dashboard-daily/daily-sections";
import {
  loadTodayAttendance,
  listDepartmentOptions,
} from "@/features/attendance-status/service";
import {
  LiveFollowRows,
  LiveStamp,
  LiveTodayProvider,
  LiveTodayStatusLine,
} from "@/features/attendance-status/live-today";
import { FollowRowLoading } from "@/features/dashboard/follow-up";
import { SectionHeading } from "@/components/shared/section-heading";
import { DepartmentFilter } from "@/features/attendance-status/department-filter";
import {
  EvaluationProgressSection,
  ProbationDueSection,
  UpcomingLeavesSection,
} from "@/features/dashboard-people/people-sections";
import { Card } from "@/components/ui/card";
import { loginIdentifier, displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LeaveIcon, StarIllustrationIcon } from "@/components/shared/illustrated-icons";
import { CheckInIcon } from "@/components/shared/menu-icons";
import type { MenuIcon } from "@/config/mobile-menu";

export const metadata: Metadata = { title: "หน้าหลัก" };

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
        {/* Remaining over entitled days as a bar; a type at a third or less turns amber with words (approved mock charts-placement-mock.html). */}
        <div className="mt-2 grid grid-cols-3 gap-3">
          {balances.map((b) => {
            const show = b.configured && b.total > 0;
            const low = show && b.remaining / b.total <= 1 / 3;
            return (
              <div key={b.type} className="min-w-0">
                <p className="text-[13px] text-muted-foreground">{b.label}</p>
                <p className="text-[22px] leading-snug font-bold tabular-nums text-foreground">
                  {b.configured ? b.remaining : "-"}
                  {show && <span className="ml-1 text-[12px] font-normal text-muted-foreground">จาก {b.total} วัน</span>}
                </p>
                {show && (
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--chart-muted-bar)]"
                    role="img"
                    aria-label={`${b.label} เหลือ ${b.remaining} จาก ${b.total} วัน`}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (b.remaining / b.total) * 100)}%`,
                        background: low ? "var(--status-late-dot)" : "var(--series-highlight)",
                      }}
                    />
                  </div>
                )}
                {low && <p className="mt-1 text-[12px] text-status-late-fg">⚠ ใกล้หมด</p>}
              </div>
            );
          })}
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


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await getCurrentUser();
  const { dept } = await searchParams;
  // Sequential, not Promise.all — connection_limit=1.
  const actions = await getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles, user!.permissions);
  const canSeePay = can(user!.permissions, "payroll:create") || can(user!.permissions, "payroll:approve");
  const mine = user!.employee ? await getMySnapshot(user!.companyId, user!.employee.id, canSeePay) : null;
  const canSeeAttendance = can(user!.permissions, "attendance:approve") || can(user!.permissions, "attendance:manage");
  // Company-wide numbers (who is late, which departments, headcount) are for HR,
  // managers and finance, not for every employee (owner's decision, 2026-11-13).
  const canSeeCompany = canSeeAttendance || can(user!.permissions, "report:read");
  // The company overview page (charts, trends, team overview): HR and finance, not a manager's team view.
  const canSeeOverview = can(user!.permissions, "report:export") || can(user!.permissions, "attendance:approve");

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
  // Fallback numbers for the status line when today's attendance list is not loaded.
  const s = canSeeCompany ? await getDashboardSummary(user!.companyId) : null;
  const attendanceToday = canSeeAttendance ? await loadTodayAttendance(user!.companyId, session, deptIds) : null;
  const departmentOptions = canSeeAttendance ? await listDepartmentOptions(user!.companyId) : [];

  const name = user?.employee ? displayName(user.employee) : loginIdentifier(user ?? {});
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;

  // Links at the end of the status line, each only for people who can open the page behind it.
  const statusLinks = (
    <>
      {canSeeAttendance && (
        <Link href="/dashboard/attendance" className="font-semibold text-primary hover:underline">
          ดูการเข้างานวันนี้
        </Link>
      )}
      {canSeeOverview && (
        <Link href="/reports/overview" className="font-semibold text-primary hover:underline">
          ดูภาพรวมบริษัท
        </Link>
      )}
    </>
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

      {/* Row 1: the work waiting for this person, then today's status in one line (approved mock home-by-role-mock.html). */}
      <div className="grid items-start gap-[22px] lg:grid-cols-2 xl:grid-cols-3">
        <section aria-label="รอคุณอนุมัติ" className="gv-rise space-y-3" style={{ "--i": 1 } as React.CSSProperties}>
          <SectionHeading title="รอคุณอนุมัติ" />
          <ActionCenter data={actions} />
        </section>
        {user!.employee && (
          <section aria-label="ประเมินที่ต้องทำ" className="gv-rise space-y-3" style={{ "--i": 2 } as React.CSSProperties}>
            <SectionHeading title="ประเมินที่ต้องทำ" />
            <Suspense fallback={<Card className="p-4 text-sm text-muted-foreground">กำลังโหลดงานประเมิน…</Card>}>
              <MyEvaluationTasks companyId={user!.companyId} session={session} />
            </Suspense>
          </section>
        )}
        {showFollow && (
          <section id="follow-up" aria-label="ต้องตามวันนี้" className="gv-rise scroll-mt-24 space-y-3" style={{ "--i": 3 } as React.CSSProperties}>
            <SectionHeading title="ต้องตามวันนี้" />
            {/* Each row loads on its own; its order value keeps the most urgent on top whatever arrives first. */}
            <Card className="@container gap-0 py-0 [&>*]:-mt-px">
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
      </div>

      {/* Today in one line; the detail and the charts are one click away. Managers' numbers are their own team. */}
      {canSeeCompany &&
        (attendanceToday ? (
          <LiveTodayStatusLine links={statusLinks} />
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3 text-[15px]">
            <span>
              วันนี้เข้างาน <b className="tabular-nums">{s?.presentToday ?? 0}</b> คน
            </span>
            <span>
              สาย <b className="tabular-nums">{s?.lateToday ?? 0}</b>
            </span>
            <span>
              ลา <b className="tabular-nums">{s?.onLeaveToday ?? 0}</b>
            </span>
            <span className="ml-auto flex flex-wrap gap-x-5 gap-y-1">{statusLinks}</span>
          </div>
        ))}

      {mine && (
        <section className="space-y-3">
          <SectionHeading title="ของฉันวันนี้" hint="เวลาเข้างาน วันลา และคะแนนของคุณ" />
          <div className={cn("grid grid-cols-2 gap-3", !showFollow && "lg:grid-cols-3")}>
            <MyTile
              icon={CheckInIcon}
              label="เวลาเข้างานวันนี้"
              value={fmtClock(mine.clockInAt) ?? "ยังไม่ลงเวลาเข้างาน"}
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
      </LiveTodayProvider>
    </>
  );
}
