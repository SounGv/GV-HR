import { CalendarView, HeadcountUsage, PresentOfApp } from "@/features/calendar/calendar-view";
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
import { accountName } from "@/lib/format";

export const metadata: Metadata = { title: "หน้าหลัก" };

/**
 * One of the boxes at the top of the home page: a label, one big figure with an optional unit, one explaining line, and a link
 * when the viewer may open it. `tone="action"` is the solid primary box that leads to a task page instead of showing a number.
 * `compact` keeps the quieter look for the employee-only boxes, whose values are text and not a count.
 */
function CountBox({
  label,
  value,
  unit,
  sub,
  href,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  tone?: "default" | "action";
  compact?: boolean;
}) {
  const action = tone === "action";
  const body = (
    <div
      className={
        action
          ? "min-h-28 rounded-lg border border-primary bg-primary px-4 py-3.5 text-primary-foreground"
          : compact
            ? "rounded-lg border border-border bg-card px-4 py-3"
            : "min-h-28 rounded-lg border border-border bg-card px-4 py-3.5"
      }
    >
      <p className={action ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{label}</p>
      <p
        className={
          action
            ? "mt-1.5 text-xl leading-[1.35] font-bold"
            : compact
              ? "mt-1 text-2xl leading-snug tabular-nums"
              : "my-0.5 text-[28px] leading-[1.35] font-bold tabular-nums"
        }
      >
        {value}
        {unit && <small className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</small>}
      </p>
      {sub && <p className={action ? "text-[13px] text-primary-foreground/90" : "text-[13px] text-muted-foreground"}>{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className={action ? "block hover:[&>div]:bg-primary/90" : "block hover:[&>div]:border-primary"}>
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

  const name = accountName(user ?? {});
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
            <CountBox compact label="เวลาเข้างานวันนี้" value={fmtClock(mine.clockInAt) ?? "ยังไม่ลงเวลา"} sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined} href="/attendance" />
            <CountBox compact label="วันลาคงเหลือ" value={mine.leaveBalances.map((b) => `${b.label} ${b.configured ? b.remaining : "-"}`).join(" · ")} href="/leave" />
            <CountBox compact label="คำขอของฉันที่รออนุมัติ" value={`${actions.myPending} รายการ`} href="/workflows" />
          </>
        )}
        {canSeeCompany && <CountBox label="พนักงาน" value={s.headcount} unit="คน" sub={<HeadcountUsage />} href={can(user!.permissions, "employee:read") ? "/employees?status=ACTIVE" : undefined} />}
        {canSeeCompany && <CountBox
            label="ลงเวลาวันนี้"
            value={s.presentToday}
            unit={<PresentOfApp />}
            sub={
              <>
                <span className="font-semibold text-status-late-fg">มาสาย {s.lateToday}</span> ·{" "}
                <span className="font-semibold text-status-leave-fg">ลา {s.onLeaveToday}</span>
              </>
            }
            href={can(user!.permissions, "report:read") ? "/dashboard/attendance" : undefined} />}
        {pendingApprovals > 0 || canSeeCompany ? <CountBox
            label="รอคุณอนุมัติ"
            value={pendingApprovals}
            unit="รายการ"
            sub={pendingApprovals === 0 ? <span className="font-semibold text-success">✓ ไม่มีงานค้าง</span> : undefined}
            href="/requests?view=approvals"
          /> : null}
        <CountBox tone="action" label="ต้องตามวันนี้" value={<>เปิดดูรายการ <span aria-hidden="true">›</span></>} sub="คนลืมสแกน ลา ครบทดลองงาน ประชุม" href="/dashboard/follow-up" />
      </div>
      {can(user!.permissions, "calendar:read") && <CalendarView />}

      </div>
    </>
  );
}
