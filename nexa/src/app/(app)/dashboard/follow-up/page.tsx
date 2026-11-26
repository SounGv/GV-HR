import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/rbac";
import {
  getActionCenter,
  getMySnapshot,
  type LeaveBalanceSummary,
} from "@/features/dashboard/service";
import { ApprovalsFollowCard, MyWorkLine } from "@/features/dashboard/action-center";
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
import { CalendarDays, ScanLine, Star } from "lucide-react";
import type { ComponentType } from "react";

export const metadata: Metadata = { title: "ต้องตามวันนี้" };

/** Remaining leave shown per type (พักร้อน/ป่วย/กิจ) — a single summed number across
 * every leave type reads as far larger than what an employee actually has left to
 * take, since sick/personal quotas get silently folded into it. */
function LeaveBalanceTile({ balances, href }: { balances: LeaveBalanceSummary[]; href: string }) {
  return (
    <Link href={href}>
      <Card className="gv-lift gap-0 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-6 text-primary" aria-hidden="true" />
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
  icon: ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="gv-lift gap-0 p-4">
        <div className="flex items-center gap-2">
          <Icon className="size-6 text-primary" />
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 truncate text-lg font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await getCurrentUser();
  const { dept } = await searchParams;
  // Sequential, not Promise.all — connection_limit=1.
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

  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;

  // Display-only re-sort (dashboard-fix-3): lateness is the real actionable
  // signal, a missing clock-in is often just an unlogged record — leaves the
  // watchlist query/service untouched, just changes the order shown here.

  return (
    <>
      <LiveTodayProvider initial={attendanceToday} departmentIds={deptIds}>
      <div className="space-y-6">
      <PageHeader title="ต้องตามวันนี้" description="เรียงจากเร่งด่วนที่สุด รวมคำขอที่รอคุณอนุมัติ กดปุ่มในการ์ดเพื่อทำต่อ" />
      {/* "ต้องตามวันนี้" board (owner-approved mock, 14 Nov 2026): one card per thing to follow, the
          most urgent first, approvals included; things with nothing today are left to the news ticker. */}
      <section id="follow-up" aria-label="ต้องตามวันนี้" className="scroll-mt-24 space-y-4">
        <div className={FOLLOW_BOARD_CLASS}>
          <ApprovalsFollowCard data={actions} />
          {attendanceToday && <LiveFollowRows />}
          {/* Order (CSS `order`): probation (most urgent), forgotten scans, OT, leave, meetings. */}
          {canSeeProbation && (
            <Suspense fallback={<FollowRowLoading order={3} />}>
              <ProbationDueSection companyId={user!.companyId} session={session} />
            </Suspense>
          )}
          {canSeeAttendance && (
            <Suspense fallback={<FollowRowLoading order={4} />}>
              <MissedScanOutSection companyId={user!.companyId} session={session} />
            </Suspense>
          )}
          {canSeeOvertime && (
            <Suspense fallback={<FollowRowLoading order={5} />}>
              <OvertimeTodaySection companyId={user!.companyId} session={session} />
            </Suspense>
          )}
          {canSeeLeaves && (
            <Suspense fallback={<FollowRowLoading order={6} />}>
              <UpcomingLeavesSection companyId={user!.companyId} session={session} />
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

      {mine && (
        <section className="space-y-3">
          <SectionHeading title="ของฉันวันนี้" hint="เวลาเข้างาน วันลา และคะแนนของคุณ" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MyTile
              icon={ScanLine}
              label="เวลาเข้างานวันนี้"
              value={fmtClock(mine.clockInAt) ?? "ยังไม่ลงเวลาเข้างาน"}
              sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined}
              href="/attendance"
            />
            <MyTile
              icon={Star}
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

      </div>
      </LiveTodayProvider>
    </>
  );
}
