import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CompetencyView } from "@/features/competency/competency-view";

export const metadata: Metadata = { title: "เกณฑ์การประเมิน" };

export default async function CompetenciesPage() {
  await requirePagePermission("campaign:read");

  return (
    <div className="space-y-6">
      <PageHeader title="เกณฑ์การประเมิน" description="จัดการหัวข้อ/ทักษะที่ใช้ประกอบแคมเปญประเมินผล" />
      <CompetencyView />
    </div>
  );
}
