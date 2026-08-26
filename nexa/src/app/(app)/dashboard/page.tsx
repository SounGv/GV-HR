import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { MobileDashboardView } from "@/components/mobile/mobile-dashboard-view";
import {
  Users,
  UserCheck,
  Clock,
  CalendarOff,
  Timer,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  LogIn,
  CalendarDays,
  Star,
  ReceiptText,
  ClipboardCheck,
  Settings,
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
import {
  AttendanceTrendChart,
  DepartmentDonut,
  DonutLegend,
  HeadcountBar,
} from "@/features/dashboard/dashboard-charts";
import { groupTopDepartments } from "@/features/dashboard/group-departments";
import { QuickAccessGrid, type QuickAccessItem } from "@/features/dashboard/quick-access-grid";
import { fullName, loginIdentifier } from "@/lib/format";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import type { EmploymentType } from "@/features/employee/types";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "แดชบอร์ด" };

// Monochrome-green icon-chip system (redesign spec) — every KPI card icon
// uses the same lime chip regardless of metric, matching the nav/menu icon
// treatment. Kept as a lookup (not a single constant) so callers keep their
// existing `tone` prop untouched; every key now resolves to the same class.
const TONES = {
  primary: "bg-icon-chip-bg text-icon-chip-fg",
  success: "bg-icon-chip-bg text-icon-chip-fg",
  warning: "bg-icon-chip-bg text-icon-chip-fg",
  danger: "bg-icon-chip-bg text-icon-chip-fg",
  info: "bg-icon-chip-bg text-icon-chip-fg",
} as const;

function Kpi({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  sub?: ReactNode;
}) {
  return (
    <Card className="gap-0 p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", TONES[tone])}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
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
              <p className="text-base font-semibold tabular-nums text-foreground">{b.remaining}</p>
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

// "เงินเดือน" deliberately left out for now — HR wants to focus rollout on
// attendance/leave and the evaluation system first. Re-add a
// { label: "เงินเดือน", href: "/payroll", permission: "payroll:read" } entry
// (import the Wallet icon from lucide-react again) here when ready.
const ALL_QUICK_ACCESS: (QuickAccessItem & { permission: string })[] = [
  { label: "พนักงาน", href: "/employees", icon: Users, permission: "employee:read" },
  { label: "เวลาเข้า-ออกงาน", href: "/attendance", icon: Clock, permission: "attendance:read" },
  { label: "การลา", href: "/leave", icon: CalendarDays, permission: "leave:read" },
  { label: "ล่วงเวลา (OT)", href: "/overtime", icon: Timer, permission: "overtime:read" },
  { label: "เบิกจ่าย", href: "/expenses", icon: ReceiptText, permission: "expense:read" },
  { label: "ประเมินผลงาน", href: "/performance", icon: ClipboardCheck, permission: "performance:read" },
  { label: "ผู้ดูแลระบบ", href: "/admin", icon: Settings, permission: "admin:read" },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [s, actions, mine] = await Promise.all([
    getDashboardSummary(user!.companyId),
    getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles),
    user!.employee ? getMySnapshot(user!.companyId, user!.employee.id) : Promise.resolve(null),
  ]);
  // Sequential, not folded into the Promise.all above — the pooled
  // connection (pgbouncer, connection_limit=1) chokes if too many Prisma
  // calls race at once; the existing 3-way Promise.all was already right at
  // the edge, these two heavier day-by-day aggregations tip it over.
  const attendanceTrend = await getAttendanceTrend(user!.companyId);
  const departmentWatchlist = await getDepartmentWatchlist(user!.companyId);

  const name = user?.employee ? fullName(user.employee.firstName, user.employee.lastName) : loginIdentifier(user ?? {});
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;
  const quickAccessItems = ALL_QUICK_ACCESS.filter((item) => can(user!.permissions, item.permission));
  const departmentDonutData = groupTopDepartments(s.byDepartment);
  const employmentTypeDonutData = groupTopDepartments(
    s.byEmploymentType.map((r) => ({ name: EMPLOYMENT_LABEL[r.type as EmploymentType] ?? r.type, count: r.count })),
  );

  return (
    <>
      <MobileDashboardView name={name} mine={mine} actions={actions} />
      <div className="hidden space-y-6 md:block">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">
          {greeting()}, {name} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          ยินดีต้อนรับเข้าสู่ GV One HR AI Platform · {user?.company?.name}
        </p>
      </div>

      <QuickAccessGrid items={quickAccessItems} />

      {/* My today — personal snapshot, not company aggregates. "เงินเดือนล่าสุด"
          deliberately left out for now, same reasoning as ALL_QUICK_ACCESS above. */}
      {mine && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
        </section>
      )}

      {/* KPI cards (today) */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="พนักงานทั้งหมด"
          value={s.headcount}
          unit="คน"
          icon={Users}
          tone="primary"
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
          icon={UserCheck}
          tone="success"
          sub={`${s.attendanceRate}% ของพนักงาน`}
        />
        <Kpi label="มาสายวันนี้" value={s.lateToday} unit="คน" icon={Clock} tone="warning" sub="ต้องติดตาม" />
        <Kpi label="ลาวันนี้" value={s.onLeaveToday} unit="คน" icon={CalendarOff} tone="danger" sub="อนุมัติแล้ว" />
        <Kpi label="OT วันนี้" value={s.otHoursToday} unit="ชม." icon={Timer} tone="info" sub="รวมทั้งองค์กร" />
      </section>

      {/* Action center */}
      <ActionCenter data={actions} />

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>สัดส่วนพนักงานตามแผนก</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DepartmentDonut data={departmentDonutData} />
            <DonutLegend data={departmentDonutData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>จำนวนพนักงานแต่ละแผนก</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/employees" />}>
              ดูทั้งหมด <ArrowRight className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <HeadcountBar data={s.byDepartment} />
          </CardContent>
        </Card>
      </section>

      {/* Attendance/leave/OT trend — "จุดสังเกต" for HR: a late/absent spike
          or a leave cluster over the last few weeks reads at a glance. */}
      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มการเข้างาน 14 วันทำการล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTrendChart data={attendanceTrend} />
        </CardContent>
      </Card>

      {/* Employee-type breakdown + department watchlist */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>สัดส่วนพนักงานตามประเภทการจ้าง</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DepartmentDonut data={employmentTypeDonutData} />
            <DonutLegend data={employmentTypeDonutData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>แผนกที่ควรติดตาม (ขาด/สาย สะสม 30 วัน)</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentWatchlist.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">ไม่มีแผนกที่ต้องติดตามในช่วงนี้ 👍</p>
            ) : (
              <HeadcountBar data={departmentWatchlist} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* AI Daily Briefing — last per the redesign spec's section order
          (Header → KPI → Tasks → Charts → Recent → AI Briefing). */}
      <Card className="relative overflow-hidden border-0 bg-sidebar p-6 text-white">
        <div className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-primary/25 blur-[90px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Sparkles className="size-5 text-primary" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                AI Daily Briefing
              </p>
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
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-white/10 text-white hover:bg-white/20"
            render={<Link href="/ai" />}
          >
            <Sparkles className="size-4" /> ถาม AI Assistant
          </Button>
        </div>
      </Card>
      </div>
    </>
  );
}
