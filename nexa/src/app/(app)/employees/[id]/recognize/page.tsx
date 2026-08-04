import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEmployee } from "@/features/employee/service";
import { AppError } from "@/lib/api/errors";
import { RecognitionFormPage } from "@/features/recognition/recognition-form-page";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "ให้กำลังใจ" };

export default async function RecognizeEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("recognition:create");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  return (
    <RecognitionFormPage employeeId={employee.id} employeeName={fullName(employee.firstName, employee.lastName)} />
  );
}
