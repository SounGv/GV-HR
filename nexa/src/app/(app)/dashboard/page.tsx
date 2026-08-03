import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
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
  Wallet,
  Star,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardSummary, getActionCenter, getMySnapshot } from "@/features/dashboard/service";
import { ActionCenter } from "@/features/dashboard/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DepartmentDonut,
  DonutLegend,
  HeadcountBar,
} from "@/features/dashboard/dashboard-charts";
import { fullName, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "แดชบอร์ด" };

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [s, actions, mine] = await Promise.all([
    getDashboardSummary(user!.companyId),
    getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles),
    user!.employee ? getMySnapshot(user!.companyId, user!.employee.id) : Promise.resolve(null),
  ]);

  const name = user?.employee ? fullName(user.employee.firstName, user.employee.lastName) : user?.email;
  const fmtClock = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {name} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          ยินดีต้อนรับเข้าสู่ NEXA HR AI Platform · {user?.company?.name}
        </p>
      </div>

      {/* My today — personal snapshot, not company aggregates */}
      {mine && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MyTile
            icon={LogIn}
            tone="success"
            label="เวลาเข้างานวันนี้"
            value={fmtClock(mine.clockInAt) ?? "ยังไม่เช็คอิน"}
            sub={fmtClock(mine.clockOutAt) ? `ออก ${fmtClock(mine.clockOutAt)}` : undefined}
            href="/attendance"
          />
          <MyTile
            icon={CalendarDays}
            tone="info"
            label="วันลาคงเหลือ"
            value={`${mine.leaveDaysRemaining} วัน`}
            href="/leave"
          />
          <MyTile
            icon={Wallet}
            tone="warning"
            label="เงินเดือนล่าสุด"
            value={mine.latestPayslip ? formatCurrency(mine.latestPayslip.net) : "-"}
            sub={mine.latestPayslip?.periodLabel}
            href="/payroll"
          />
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

      {/* AI Daily Briefing */}
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
            <Sparkles className="size-4" /> ถาม NEXA AI
          </Button>
        </div>
      </Card>

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
            <DepartmentDonut data={s.byDepartment} />
            <DonutLegend data={s.byDepartment} />
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
    </div>
  );
}
