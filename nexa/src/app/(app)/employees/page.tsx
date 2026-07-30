import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeTable } from "@/features/employee/employee-table";

export const metadata: Metadata = { title: "พนักงาน" };

export default async function EmployeesPage() {
  await requirePagePermission("employee:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="พนักงานและองค์กร"
        description="จัดการข้อมูลพนักงานทั้งหมดในองค์กร"
      />
      <EmployeeTable />
    </div>
  );
}
