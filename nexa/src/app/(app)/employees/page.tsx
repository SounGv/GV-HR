import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardSummary } from "@/features/dashboard/service";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmployeeTable } from "@/features/employee/employee-table";

export const metadata: Metadata = { title: "Employee Center" };

/** Same KPI-dot pattern as the dashboard's own Kpi cards (a color dot, not
 * an icon chip) — one glance across the row reads as a category key. */
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
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
        <MiniStat label="พนักงานทั้งหมด" value={s.headcount} color="var(--series-leave)" />
        <MiniStat label="ปฏิบัติงาน" value={s.active} color="var(--series-present)" />
        <MiniStat label="ลางาน" value={s.onLeave} color="var(--series-late)" />
        <MiniStat label="เข้าใหม่เดือนนี้" value={s.newThisMonth} color="var(--series-ot)" />
      </section>

      <EmployeeTable />
    </div>
  );
}
