import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ImportHub } from "@/features/import-center/import-hub";

export const metadata: Metadata = { title: "นำเข้าข้อมูล" };

export default async function ImportCenterPage() {
  await requirePagePermission("employee:create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ศูนย์นำเข้าข้อมูล (Import Center)"
        description="อัปโหลด CSV เพื่อเพิ่ม/อัปเดตข้อมูลเป็นชุด พร้อมตรวจสอบและตัวอย่างก่อนนำเข้าจริงทุกครั้ง"
      />
      <ImportHub />
    </div>
  );
}
