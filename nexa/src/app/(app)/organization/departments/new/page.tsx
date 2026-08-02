import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { DepartmentFormPage } from "@/features/organization/department-form-page";

export const metadata: Metadata = { title: "เพิ่มฝ่าย/แผนก" };

export default async function NewDepartmentPage() {
  await requirePagePermission("employee:create");
  return <DepartmentFormPage />;
}
