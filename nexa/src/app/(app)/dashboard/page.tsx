import { CalendarView } from "@/features/calendar/calendar-view";
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
import { ApprovalsFollowCard, MyWorkLine } from "@/features/dashboard/action-center";
import { FollowCount } from "@/features/dashboard/follow-count";
import { MeetingsTodaySection, MissedScanOutSection, OvertimeTodaySection } from "@/features/dashboard-daily/daily-sections";
import {
  loadTodayAttendance,
  } from "@/features/attendance-status/service";
import {
  LiveFollowRows,
  LiveTodayProvider,
} from "@/features/attendance-status/live-today";
import { FOLLOW_BOARD_CLASS, FollowRowLoading } from "@/features/dashboard/follow-up";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  ProbationDueSection,
  UpcomingLeavesSection,
} from "@/features/dashboard-people/people-sections";
import { DueSoonSection } from "@/features/dashboard-people/due-soon-section";
import { Card } from "@/components/ui/card";
import { loginIdentifier, displayName } from "@/lib/format";
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
        <div className="mt-2 grid grid-cols-3 gap-1 text-center">
          {balances.map((b) => (
            <div key={b.type}>
              <p className="text-base font-semibold tabular-nums text-foreground">
                {b.configured ? b.remaining : "-"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{b.label}</p>
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the four plain boxes at the top of the home page: a label and one figure, a link when the viewer may open it. */
function CountBox({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl leading-snug tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:[&>div]:border-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

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
  const canSeeDueSoon = can(user!.permissions, "employee:update") || can(user!.permissions, "holiday:create");
  const canSeeOvertime = can(user!.permissions, "overtime:approve") || can(user!.permissions, "overtime:manage");
  const canSeeMeetings = can(user!.permissions, "meeting:read");
  const attendanceToday = canSeeAttendance ? await loadTodayAttendance(user!.companyId, session, deptIds) : null;

  const name = user?.employee ? displayName(user.employee) : loginIdentifier(user ?? {});
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;

  // Display-only re-sort (dashboard-fix-3): lateness is the real actionable
  // signal, a missing clock-in is often just an unlogged record — leaves the
  // watchlist query/service untouched, just changes the order shown here.
  const pendingApprovals = Object.values(actions.approvals).reduce((sum, n) => sum + n, 0);

  return (
    <>
      <MobileDashboardView name={name} mine={mine} actions={actions} />
      <LiveTodayProvider initial={attendanceToday} departmentIds={deptIds}>
      <div className="theme-flip7 gv-page-band hidden space-y-6 md:-mx-6 md:-mt-6 md:block md:px-6 md:pt-6">
      {/* Favpo home: the company name, four plain count boxes, then the month calendar. Everything that needs doing today
          (approvals, follow-up board, evaluations) follows below. */}
      <p className="text-base font-medium">{user?.company?.name}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CountBox label="พนักงาน" value={`${s.headcount} คน`} href={can(user!.permissions, "employee:read") ? "/employees?status=ACTIVE" : undefined} />
        <CountBox label="ลงเวลาวันนี้" value={`${s.presentToday} คน`} sub={`มาสาย ${s.lateToday} · ลา ${s.onLeaveToday}`} href={can(user!.permissions, "report:read") ? "/dashboard/attendance" : undefined} />
        <CountBox label="รอคุณอนุมัติ" value={`${pendingApprovals} รายการ`} href="/requests?view=approvals" />
        <CountBox label="ต้องตามวันนี้" value={<FollowCount />} href="#follow-up" />
      </div>
      {can(user!.permissions, "calendar:read") && <CalendarView />}

      {/* "ต้องตามวันนี้" board (owner-approved mock, 14 Nov 2026): one card per thing to follow, the
          most urgent first, approvals included; things with nothing today are left to the news ticker. */}
      <section id="follow-up" aria-label="ต้องตามวันนี้" className="scroll-mt-24 space-y-3">
        <SectionHeading title="ต้องตามวันนี้" hint="เรียงจากเร่งด่วนที่สุด · รวมคำขอที่รอคุณอนุมัติ · กดปุ่มในการ์ดเพื่อทำต่อ" />
        <div className={FOLLOW_BOARD_CLASS}>
          <ApprovalsFollowCard data={actions} />
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
          {canSeeMeetings && (
            <Suspense fallback={<FollowRowLoading order={8} />}>
              <MeetingsTodaySection companyId={user!.companyId} employeeId={user!.employee?.id} />
            </Suspense>
          )}
        </div>
        <MyWorkLine data={actions} />
      </section>

      {canSeeDueSoon && (
        <Suspense fallback={null}>
          <DueSoonSection companyId={user!.companyId} session={session} />
        </Suspense>
      )}

      {/* The evaluation rounds and their results are on the evaluation pages (ประเมินและพัฒนา), not repeated on the home page. */}

      {mine && (
        <section className="space-y-3">
          <SectionHeading title="ของฉันวันนี้" hint="เวลาเข้างาน วันลา และคะแนนของคุณ" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
            <div className="col-span-2 lg:col-span-1">
              <LeaveBalanceTile balances={mine.leaveBalances} href="/leave" />
            </div>
          </div>
        </section>
      )}

      {/* The company's attendance picture (ring, late, absent, 14 days, trends, departments) is on its own pages, not on the home page:
          the attendance box above opens it, and the numbers over time are in the reports. */}
      </div>
      </LiveTodayProvider>
    </>
  );
}
