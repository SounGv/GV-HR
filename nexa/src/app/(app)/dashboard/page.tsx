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
import { AttendanceStackedBar, Sparkline } from "@/features/dashboard/dashboard-charts";
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

/** KPI card — a small color dot instead of an icon chip (N mockup spec):
 * reads as a quick categorical key at a glance across the whole row. */
function Kpi({
  label,
  value,
  unit,
  color,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  sub?: ReactNode;
  trend?: { values: number[]; color: string };
}) {
  return (
    <Card className="gap-0 p-5 transition hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
      {trend && trend.values.length >= 2 && (
        <div className="mt-2">
          <Sparkline values={trend.values} color={trend.color} label={`แนวโน้ม 14 วันทำการล่าสุด: ${label}`} />
        </div>
      )}
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
  const absentSum = attendanceTrend.reduce((sum, d) => sum + d.absent, 0);

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
        />
        <Kpi
          label="เข้างานวันนี้"
          value={s.presentToday}
          unit="คน"
          color="#1A7F4E"
          sub={`${s.attendanceRate}% ของพนักงาน`}
          trend={{ values: attendanceTrend.map((p) => p.present), color: "#0e9f8e" }}
        />
        <Kpi
          label="มาสายวันนี้"
          value={s.lateToday}
          unit="คน"
          color="#FFB900"
          sub="ต้องติดตาม"
          trend={{ values: attendanceTrend.map((p) => p.late), color: "#f59e0b" }}
        />
        <Kpi
          label="ลาวันนี้"
          value={s.onLeaveToday}
          unit="คน"
          color="#22A55B"
          sub="อนุมัติแล้ว"
          trend={{ values: attendanceTrend.map((p) => p.leave), color: "#8b5cf6" }}
        />
        <Kpi
          label="OT วันนี้"
          value={s.otHoursToday}
          unit="ชม."
          color="#F5A524"
          sub="รวมทั้งองค์กร"
          trend={{ values: attendanceTrend.map((p) => p.otHours), color: "#3b82f6" }}
        />
      </section>

      {/* Attendance composition — per-day stacked bar (on-time/late/leave/
          absent) plus a rolled-up summary alongside it. */}
      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>การเข้างาน 14 วันทำการล่าสุด</CardTitle>
            <p className="text-xs text-muted-foreground">จำนวนคนต่อวัน แยกตามสถานะ</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <LegendDot color="#3A3F45" label="มาทำงาน" />
            <LegendDot color="#FFB900" label="มาสาย" />
            <LegendDot color="#3B82F6" label="ลา" />
            <LegendDot color="#E5484D" label="ขาดงาน" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <AttendanceStackedBar data={attendanceTrend} />
            </div>
            <div className="flex shrink-0 flex-row gap-2.5 lg:w-[200px] lg:flex-col">
              <div className="flex flex-1 flex-col rounded-2xl bg-sidebar p-3 text-white lg:flex-none">
                <span className="text-xs text-slate-300">อัตราเข้างานเฉลี่ย</span>
                <span className="text-2xl font-bold text-[#CDEB03] tabular-nums">{avgAttendanceRate}%</span>
              </div>
              <div className="flex flex-1 flex-col rounded-2xl bg-warning/15 p-3 lg:flex-none">
                <span className="text-xs text-warning">มาสายรวม</span>
                <span className="text-xl font-bold tabular-nums">{lateSum} ครั้ง</span>
              </div>
              <div className="flex flex-1 flex-col rounded-2xl bg-destructive-muted p-3 lg:flex-none">
                <span className="text-xs text-destructive">ขาดงานรวม</span>
                <span className="text-xl font-bold tabular-nums">{absentSum} ครั้ง</span>
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
            {departmentWatchlist.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีแผนกที่ต้องติดตามในช่วงนี้ 👍</p>
            ) : (
              <div className="flex flex-col gap-1">
                {departmentWatchlist.map((w) => {
                  const max = Math.max(...departmentWatchlist.map((r) => r.absent + r.late), 1);
                  return (
                    <div key={w.name} className="grid grid-cols-[140px_1fr_150px] items-center gap-3 rounded-xl p-2">
                      <span className="truncate text-sm font-medium">{w.name}</span>
                      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
                        <div style={{ width: `${(w.absent / max) * 100}%`, background: "#E5484D" }} />
                        <div style={{ width: `${(w.late / max) * 100}%`, background: "#FFB900" }} />
                      </div>
                      <span className="text-right text-xs text-muted-foreground tabular-nums">
                        ขาด <b className="text-destructive">{w.absent}</b> สาย <b className="text-warning">{w.late}</b>
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} /> {label}
    </span>
  );
}
