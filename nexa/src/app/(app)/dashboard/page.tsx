import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserCheck, CalendarOff, UserPlus, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardSummary, getActionCenter } from "@/features/dashboard/service";
import { ActionCenter } from "@/features/dashboard/action-center";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DepartmentDonut,
  DonutLegend,
  HeadcountBar,
} from "@/features/dashboard/dashboard-charts";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "แดชบอร์ด" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [summary, actions] = await Promise.all([
    getDashboardSummary(user!.companyId),
    getActionCenter(user!.companyId, user!.employee?.id ?? null, user!.roles),
  ]);

  const name = user?.employee
    ? fullName(user.employee.firstName, user.employee.lastName)
    : user?.email;
  const today = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <section className="overflow-hidden rounded-2xl bg-sidebar p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-slate-400">{today}</p>
            <h1 className="text-2xl font-semibold">สวัสดี {name}</h1>
            <p className="text-sm text-slate-300">
              ยินดีต้อนรับสู่ NEXA People Platform · {user?.company?.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" render={<Link href="/employees" />}>
              <Users className="size-4" /> พนักงาน
            </Button>
            <Button
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
              render={<Link href="/attendance" />}
            >
              เช็คอิน
            </Button>
            <Button
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
              render={<Link href="/leave" />}
            >
              ขอลา
            </Button>
          </div>
        </div>
      </section>

      {/* Action center — role-aware pending items */}
      <ActionCenter data={actions} />

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="พนักงานทั้งหมด" value={summary.headcount} unit="คน" icon={Users} tone="primary" />
        <StatCard label="ปฏิบัติงาน" value={summary.active} unit="คน" icon={UserCheck} tone="success" />
        <StatCard label="ลางาน" value={summary.onLeave} unit="คน" icon={CalendarOff} tone="warning" />
        <StatCard label="เข้าใหม่เดือนนี้" value={summary.newThisMonth} unit="คน" icon={UserPlus} tone="info" />
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>สัดส่วนพนักงานตามแผนก</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DepartmentDonut data={summary.byDepartment} />
            <DonutLegend data={summary.byDepartment} />
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
            <HeadcountBar data={summary.byDepartment} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
