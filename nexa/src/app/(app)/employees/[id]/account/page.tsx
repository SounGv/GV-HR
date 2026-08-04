import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEmployee } from "@/features/employee/service";
import { AppError } from "@/lib/api/errors";
import { EmployeeAccountFormPage } from "@/features/employee/employee-account-form-page";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "บัญชีเข้าใช้งาน" };

export default async function EmployeeAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("employee:update");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  return (
    <EmployeeAccountFormPage
      employeeId={employee.id}
      employeeName={fullName(employee.firstName, employee.lastName)}
      hasAccount={!!employee.userId}
      defaultEmail={employee.email}
    />
  );
}
