import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { FormListView } from "@/features/appraisal-form/form-list-view";

export const metadata: Metadata = { title: "แบบประเมิน" };

export default async function AppraisalFormsPage() {
  await requirePagePermission("campaign:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="แบบประเมิน" description="สร้างแบบประเมินที่ใช้กับรอบประเมิน แบบมีเวอร์ชัน" />
      <FormListView />
    </div>
  );
}
