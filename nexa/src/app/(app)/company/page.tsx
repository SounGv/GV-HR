import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyProfileForm } from "@/features/company/company-profile-form";

export const metadata: Metadata = { title: "ข้อมูลบริษัท" };

export default async function CompanyPage() {
  await requirePagePermission("admin:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="ข้อมูลบริษัท"
        description="โปรไฟล์องค์กร โลโก้ แบรนด์ ที่อยู่ และการตั้งค่าภูมิภาค — ใช้ทั่วทั้งระบบ"
      />
      <CompanyProfileForm />
    </div>
  );
}
