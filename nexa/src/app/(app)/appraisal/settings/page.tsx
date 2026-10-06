import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsPage } from "@/features/appraisal-round/settings-view";

export const metadata: Metadata = { title: "ตั้งค่าการประเมิน" };

export default async function AppraisalSettingsPage() {
  await requirePagePermission("campaign:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="ตั้งค่าการประเมิน" description="วิธีคิดคะแนน เกณฑ์เกรด การอนุมัติ และสิทธิ์การเห็นผล" />
      <SettingsPage />
    </div>
  );
}
