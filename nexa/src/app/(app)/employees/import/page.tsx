import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ImportCenter } from "@/features/employee-import/import-center";

export const metadata: Metadata = { title: "นำเข้าพนักงาน" };

export default async function EmployeeImportPage() {
  await requirePagePermission("employee:create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="นำเข้าพนักงาน (Import)"
        description="อัปโหลด CSV เพื่อเพิ่มหรืออัปเดตพนักงานเป็นชุด พร้อมตรวจสอบและตัวอย่างก่อนนำเข้า"
      />
      <ImportCenter />
    </div>
  );
}
