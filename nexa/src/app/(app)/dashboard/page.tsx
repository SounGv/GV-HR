import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { MobileDashboardView } from "@/components/mobile/mobile-dashboard-view";
import {
  ArrowUpRight,
  ArrowRight,
  LogIn,
  CalendarDays,
  Star,
  TriangleAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getDashboardSummary,
  getActionCenter,
  getMySnapshot,
  getAttendanceTrend,
  getDepartmentWatchlist,
  type LeaveBalanceSummary,
} from "@/features/dashboard/service";
import { ActionCenter } from "@/features/dashboard/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AttendanceRateLine, KpiMiniBars } from "@/features/dashboard/dashboard-charts";
import { groupTopDepartments } from "@/features/dashboard/group-departments";
import { fullName, loginIdentifier } from "@/lib/format";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import type { EmploymentType } from "@/features/employee/types";
import { cn } from "@/lib/utils";
import { PeopleIcon, DailyWorkerIcon } from "@/components/shared/illustrated-icons";

export const metadata: Metadata = { title: "แดชบอร์ด" };

// Monochrome-green icon-chip system (redesign spec) — every non-KPI icon
// chip uses the same lime chip regardless of metric, matching the nav/menu
// icon treatment. `warning` is the one deliberate exception: it's reserved
// for a metric that genuinely needs follow-up, so a real amber status
// color, not decorative per-metric variety, makes that one read as a flag.
const TONES = {
  primary: "bg-icon-chip-bg text-icon-chip-fg",
  success: "bg-icon-chip-bg text-icon-chip-fg",
  warning: "bg-warning/15 text-warning",
  danger: "bg-icon-chip-bg text-icon-chip-fg",
  info: "bg-icon-chip-bg text-icon-chip-fg",
} as const;

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
    <Card className="gap-0 p-5 transition hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {miniBars && <TrendBadge data={miniBars.data} goodDirection={miniBars.goodDirection} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
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
      <Card className="gap-0 p-4 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONES.info)}>
            <CalendarDays className="size-4" />
          </span>
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
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="gap-0 p-4 transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center gap-2">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
            <Icon className="size-4" />
          </span>
          <span className="truncate text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="mt-2 truncate text-lg font-semibold tracking-tight">{value}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

/** One illustrated icon per employment type — daily workers get their own
 * artwork (matches the N mockup exactly); every other type (full-time,
 * part-time, contract, etc.) shares a generic "people" mark since the
 * mockup only ever distinguishes those two categories visually. */
function employmentTypeIcon(type: string) {
  return type === "DAILY_WORKER" ? DailyWorkerIcon : PeopleIcon;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  // Sequential, not Promise.all — connection_limit=1.
  const s = await getDashboardSummary(user!.companyId);
  const actions = await getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles, user!.permissions);
  const mine = user!.employee ? await getMySnapshot(user!.companyId, user!.employee.id) : null;
  const attendanceTrend = await getAttendanceTrend(user!.companyId);
  const departmentWatchlist = await getDepartmentWatchlist(user!.companyId);

  const name = user?.employee ? fullName(user.employee.firstName, user.employee.lastName) : loginIdentifier(user ?? {});
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
  const departmentWatchlistRanked = [...departmentWatchlist].sort(
    (a, b) => b.late - a.late || b.absent - a.absent,
  );

  return (
    <>
      <MobileDashboardView name={name} mine={mine} actions={actions} />
      <div className="hidden space-y-6 md:block">
      {/* Greeting + AI summary — plain text header, one dark AI card right
          under it (redesign spec: N mockup merges what used to be two
          separate dark hero cards bookending the page into this single one). */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">
          {greeting()}, {name} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          ยินดีต้อนรับเข้าสู่ GV One HR AI Platform · {user?.company?.name}
        </p>
      </div>

      <Card className="relative overflow-hidden border-0 bg-sidebar p-5 text-white">
        <div className="pointer-events-none absolute -top-16 -left-10 size-72 rounded-full bg-[#CDEB03]/20 blur-[90px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Sparkles className="size-5 text-[#CDEB03]" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold tracking-wide text-[#CDEB03] uppercase">สรุปวันนี้จาก AI</p>
            <p className="text-sm leading-relaxed text-slate-100">
              วันนี้พนักงานเข้างาน <b className="text-white">{s.presentToday}</b> คน
              ({s.attendanceRate}%) · มาสาย <b className="text-white">{s.lateToday}</b> คน ·
              ลา <b className="text-white">{s.onLeaveToday}</b> คน ·
              OT <b className="text-white">{s.otHoursToday}</b> ชม.
              {s.lateToday > 0
                ? " แนะนำให้ตรวจสอบพนักงานที่มาสายและติดตามเป็นรายบุคคล"
                : " อัตราการเข้างานอยู่ในเกณฑ์ดี 👍"}
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-[#CDEB03] text-[#131516] hover:brightness-105"
            render={<Link href="/ai" />}
          >
            <Sparkles className="size-4" /> ถาม AI Assistant
          </Button>
        </div>
      </Card>

      {/* My today — personal snapshot, not company aggregates. "เงินเดือนล่าสุด"
          deliberately left out for now — HR wants to focus rollout on
          attendance/leave and the evaluation system first. */}
      {mine && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">ของฉันวันนี้</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MyTile
              icon={LogIn}
              tone="success"
              label="เวลาเข้างานวันนี้"
              value={fmtClock(mine.clockInAt) ?? "ยังไม่เช็คอิน"}
              sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined}
              href="/attendance"
            />
            <LeaveBalanceTile balances={mine.leaveBalances} href="/leave" />
            <MyTile
              icon={Star}
              tone="primary"
              label="คะแนนให้กำลังใจ"
              value={`${mine.recognition.star + mine.recognition.award + mine.recognition.heart}`}
              sub={`+${mine.recognition.point} คะแนน`}
              href="/attendance"
            />
          </div>
        </section>
      )}

      {/* Action center */}
      <ActionCenter data={actions} />

      {/* KPI cards (today) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="พนักงานทั้งหมด"
          value={s.headcount}
          unit="คน"
          color="#3B82F6"
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
                  style={{ width: `${t.pct}%`, background: t.type === "DAILY_WORKER" ? "#F5A524" : "#131516" }}
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

      {/* Attendance rate line (dashboard-fix-3) — % of headcount per business
          day, plus a rolled-up summary alongside it. */}
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
            <div className="grid shrink-0 grid-cols-2 gap-2.5 lg:w-[220px] lg:grid-cols-1">
              <div className="flex flex-col rounded-2xl p-3" style={{ background: "var(--series-highlight)" }}>
                <span className="text-xs text-[#131516]/70">เข้างานเฉลี่ย</span>
                <span className="text-2xl font-bold text-[#131516] tabular-nums">{avgAttendanceRate}%</span>
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
          </div>
        </CardContent>
      </Card>

      {/* Employment-type breakdown + department watchlist */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>ประเภทการจ้าง</CardTitle>
            <p className="text-xs text-muted-foreground">ทั้งหมด {s.headcount} คน</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-[18px] gap-[3px] overflow-hidden rounded-full">
              {employmentTypes.map((t) => (
                <div
                  key={t.type}
                  style={{ width: `${t.pct}%`, background: t.type === "DAILY_WORKER" ? "#F5A524" : "#131516" }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {employmentTypes.map((t) => {
                const Icon = employmentTypeIcon(t.type);
                return (
                  <div key={t.type} className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
                    <Icon size={36} />
                    <span className="flex-1 text-sm">{t.label}</span>
                    <span className="text-lg font-bold tabular-nums">{t.count}</span>
                    <span className="w-9 text-right text-xs text-muted-foreground">{t.pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
      </div>

      {/* Department ranking — full width, no donut companion (the donut read
          as a near-duplicate of this ranked list at a glance). */}
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>พนักงานแต่ละแผนก</CardTitle>
            <p className="text-xs text-muted-foreground">{departmentRanked.length} แผนกที่มีคนมากที่สุด</p>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/employees" />}>
            ดูทุกแผนก <ArrowRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex flex-col rounded-2xl bg-sidebar p-3 text-white">
              <span className="text-xs text-slate-300">พนักงานทั้งหมด</span>
              <span className="text-2xl font-bold text-[#CDEB03] tabular-nums">
                {s.headcount} <span className="text-sm font-medium text-white">คน</span>
              </span>
            </div>
            <div className="flex flex-col rounded-2xl bg-surface-muted p-3">
              <span className="text-xs text-muted-foreground">จำนวนแผนก</span>
              <span className="text-2xl font-bold tabular-nums">
                {departmentRanked.length} <span className="text-sm font-medium text-muted-foreground">แผนก</span>
              </span>
            </div>
            <div className="flex flex-col rounded-2xl bg-surface-muted p-3">
              <span className="text-xs text-muted-foreground">เฉลี่ยต่อแผนก</span>
              <span className="text-2xl font-bold tabular-nums">
                {departmentRanked.length > 0 ? (s.headcount / departmentRanked.length).toFixed(1) : "0"}{" "}
                <span className="text-sm font-medium text-muted-foreground">คน</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {departmentRanked.map((d, i) => {
              const max = Math.max(...departmentRanked.map((r) => r.count), 1);
              const isTop = i === 0;
              const isPodium = i < 3;
              return (
                <div
                  key={d.name}
                  className={cn(
                    "grid grid-cols-[28px_180px_1fr_76px] items-center gap-3 rounded-xl p-2",
                    isTop && "bg-[#F4FAD2]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[26px] items-center justify-center rounded-lg text-[13px] font-bold tabular-nums",
                      isTop ? "bg-[#CDEB03] text-[#131516]" : isPodium ? "bg-[#131516] text-white" : "bg-surface-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn("truncate text-sm", isPodium ? "font-semibold" : "font-normal")}>{d.name}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(d.count / max) * 100}%`,
                        background: isPodium ? "linear-gradient(90deg, #3A3F45 0%, #131516 100%)" : "linear-gradient(90deg, #B8BEC4 0%, #8A9199 100%)",
                      }}
                    />
                  </div>
                  <span className="flex items-baseline justify-end gap-1.5 tabular-nums">
                    <span className="text-base font-bold">{d.count}</span>
                    <span className="w-8 text-right text-xs text-muted-foreground">
                      {s.headcount > 0 ? Math.round((d.count / s.headcount) * 100) : 0}%
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
