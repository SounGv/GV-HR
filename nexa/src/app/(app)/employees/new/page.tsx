import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { EmployeeFormPage } from "@/features/employee/employee-form-page";

export const metadata: Metadata = { title: "เพิ่มพนักงานใหม่" };

export default async function NewEmployeePage() {
  await requirePagePermission("employee:create");
  return <EmployeeFormPage mode="new" />;
}
