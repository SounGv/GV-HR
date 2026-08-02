import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getDepartment } from "@/features/organization/service";
import { DepartmentFormPage } from "@/features/organization/department-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขฝ่าย/แผนก" };

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("employee:update");
  const { id } = await params;

  const d = await getDepartment(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <DepartmentFormPage department={d} />;
}
