import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEmployee } from "@/features/employee/service";
import { getEmployeeLogin } from "@/features/employee/account";
import { AppError } from "@/lib/api/errors";
import { EmployeeAccountFormPage } from "@/features/employee/employee-account-form-page";
import { displayName } from "@/lib/format";

export const metadata: Metadata = { title: "บัญชีเข้าใช้งาน" };

export default async function EmployeeAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("employee:update");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  const login = employee.userId ? await getEmployeeLogin(session.companyId, employee.id) : null;

  return (
    <EmployeeAccountFormPage
      currentLogin={login}
      employeeId={employee.id}
      employeeName={displayName(employee)}
      hasAccount={!!employee.userId}
      defaultEmail={employee.email}
    />
  );
}
