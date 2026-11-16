import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardSummary } from "@/features/dashboard/service";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeTable } from "@/features/employee/employee-table";

export const metadata: Metadata = { title: "รายชื่อพนักงาน" };

export default async function EmployeesPage() {
  await requirePagePermission("employee:read");
  const user = await getCurrentUser();
  const s = await getDashboardSummary(user!.companyId);

  return (
    <div className="space-y-6">
      <PageHeader title="รายชื่อพนักงาน" />

      {/* Phones and narrow windows: one compact line. On a wide screen the same numbers sit in the filter row of the table. */}
      <dl className="gv-lg-card flex flex-wrap gap-x-4 gap-y-0.5 px-4 py-2 text-xs lg:hidden">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">ทั้งหมด</dt>
          <dd className="text-base font-semibold tabular-nums">{s.headcount}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">ปฏิบัติงาน</dt>
          <dd className="text-base font-semibold tabular-nums">{s.active}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">ลางาน</dt>
          <dd className="text-base font-semibold tabular-nums">{s.onLeave}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">เข้าใหม่เดือนนี้</dt>
          <dd className="text-base font-semibold tabular-nums">{s.newThisMonth}</dd>
        </div>
      </dl>

      <EmployeeTable summary={{ headcount: s.headcount, active: s.active, onLeave: s.onLeave, newThisMonth: s.newThisMonth }} />
    </div>
  );
}
