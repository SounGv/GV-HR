import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEmployee } from "@/features/employee/service";
import { serializeEmployeeDetail } from "@/features/employee/serialize";
import { EmployeeFormPage } from "@/features/employee/employee-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขข้อมูลพนักงาน" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("employee:update");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <EmployeeFormPage mode="edit" employee={serializeEmployeeDetail(employee)} />;
}
