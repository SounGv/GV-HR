import type { Metadata } from "next";
import { Users, UserCheck, CalendarOff, UserPlus, type LucideIcon } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardSummary } from "@/features/dashboard/service";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmployeeTable } from "@/features/employee/employee-table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Employee Center" };

// Monochrome-green icon-chip system (redesign spec) — same chip for every
// metric type, matching the nav/menu icon treatment.
const TONES = {
  primary: "bg-icon-chip-bg text-icon-chip-fg",
  success: "bg-icon-chip-bg text-icon-chip-fg",
  warning: "bg-icon-chip-bg text-icon-chip-fg",
  info: "bg-icon-chip-bg text-icon-chip-fg",
} as const;

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: keyof typeof TONES;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span className={cn("flex size-10 items-center justify-center rounded-xl", TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <div>
        <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

export default async function EmployeesPage() {
  await requirePagePermission("employee:read");
  const user = await getCurrentUser();
  const s = await getDashboardSummary(user!.companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Center"
        description="ทำเนียบพนักงานและข้อมูลบุคลากรทั้งองค์กร"
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="พนักงานทั้งหมด" value={s.headcount} icon={Users} tone="primary" />
        <MiniStat label="ปฏิบัติงาน" value={s.active} icon={UserCheck} tone="success" />
        <MiniStat label="ลางาน" value={s.onLeave} icon={CalendarOff} tone="warning" />
        <MiniStat label="เข้าใหม่เดือนนี้" value={s.newThisMonth} icon={UserPlus} tone="info" />
      </section>

      <EmployeeTable />
    </div>
  );
}
