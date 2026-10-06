import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { YearSetupView } from "@/features/leave/year-setup-view";

export const metadata: Metadata = { title: "ตั้งสิทธิ์ลาปีใหม่" };

/** HR only. */
export default async function LeaveYearSetupPage() {
  await requirePagePermission("employee:update");
  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งสิทธิ์ลาปีใหม่" description="สร้างสิทธิ์ลาของปีถัดไปจากปีเดิม ดูตัวอย่างก่อนสร้างทุกครั้ง" />
      <YearSetupView />
    </div>
  );
}
