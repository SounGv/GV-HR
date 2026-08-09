import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CorrectionView } from "@/features/attendance-correction/correction-view";

export const metadata: Metadata = { title: "แก้ไขเวลาเข้า-ออกงาน" };

export default async function AttendanceCorrectionsPage() {
  await requirePagePermission("attendance:read");

  return (
    <div className="space-y-6">
      <PageHeader title="แก้ไขเวลาเข้า-ออกงาน" description="ส่งคำขอแก้ไขเวลาเข้า-ออกงาน และอนุมัติคำขอของทีม" />
      <CorrectionView />
    </div>
  );
}
