import { CalendarView } from "@/features/calendar/calendar-view";
import type { Metadata } from "next";
import Link from "next/link";
import { MobileDashboardView } from "@/components/mobile/mobile-dashboard-view";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/rbac";
import {
  getDashboardSummary,
  getActionCenter,
  getMySnapshot,
  } from "@/features/dashboard/service";
import { loginIdentifier, displayName } from "@/lib/format";

export const metadata: Metadata = { title: "หน้าหลัก" };

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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Sequential, not Promise.all — connection_limit=1.
  const s = await getDashboardSummary(user!.companyId);
  const actions = await getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles, user!.permissions);
  const canSeePay = can(user!.permissions, "payroll:create") || can(user!.permissions, "payroll:approve");
  const mine = user!.employee ? await getMySnapshot(user!.companyId, user!.employee.id, canSeePay) : null;
  const canSeeAttendance = can(user!.permissions, "attendance:approve") || can(user!.permissions, "attendance:manage");
  const canSeeCompany = canSeeAttendance || can(user!.permissions, "report:read");
  // Company-wide numbers (who is late, which departments, headcount) are for HR,
  // managers and finance, not for every employee (owner's decision, 2026-11-13).

  const name = user?.employee ? displayName(user.employee) : loginIdentifier(user ?? {});
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;

  const pendingApprovals = Object.values(actions.approvals).reduce((sum, n) => sum + n, 0);

  return (
    <>
      <MobileDashboardView name={name} mine={mine} actions={actions} />
      <div className="theme-flip7 gv-page-band hidden space-y-6 md:-mx-6 md:-mt-6 md:block md:px-6 md:pt-6">
      {/* Favpo home: the company name, count boxes, then the month calendar. What needs doing today is on its own page
          (ต้องตามวันนี้), the evaluation on the evaluation pages, attendance over time on the attendance and report pages. */}
      <p className="text-base font-medium">{user?.company?.name}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!canSeeCompany && mine && (
          <>
            <CountBox label="เวลาเข้างานวันนี้" value={fmtClock(mine.clockInAt) ?? "ยังไม่ลงเวลา"} sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined} href="/attendance" />
            <CountBox label="วันลาคงเหลือ" value={mine.leaveBalances.map((b) => `${b.label} ${b.configured ? b.remaining : "-"}`).join(" · ")} href="/leave" />
            <CountBox label="คำขอของฉันที่รออนุมัติ" value={`${actions.myPending} รายการ`} href="/workflows" />
          </>
        )}
        {canSeeCompany && <CountBox label="พนักงาน" value={`${s.headcount} คน`} href={can(user!.permissions, "employee:read") ? "/employees?status=ACTIVE" : undefined} />}
        {canSeeCompany && <CountBox label="ลงเวลาวันนี้" value={`${s.presentToday} คน`} sub={`มาสาย ${s.lateToday} · ลา ${s.onLeaveToday}`} href={can(user!.permissions, "report:read") ? "/dashboard/attendance" : undefined} />}
        {pendingApprovals > 0 || canSeeCompany ? <CountBox label="รอคุณอนุมัติ" value={`${pendingApprovals} รายการ`} href="/requests?view=approvals" /> : null}
        <CountBox label="ต้องตามวันนี้" value="เปิดดูรายการ" sub="คนลืมสแกน ลา ครบทดลองงาน ประชุม" href="/dashboard/follow-up" />
      </div>
      {can(user!.permissions, "calendar:read") && <CalendarView />}

      </div>
    </>
  );
}
