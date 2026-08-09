import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CorrectionFormPage } from "@/features/attendance-correction/correction-form-page";

export const metadata: Metadata = { title: "แก้ไขเวลาเข้า-ออกงาน" };

export default async function NewAttendanceCorrectionPage() {
  await requirePagePermission("attendance:create");
  return <CorrectionFormPage />;
}
