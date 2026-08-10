import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateListView } from "@/features/evaluation-template/template-list-view";

export const metadata: Metadata = { title: "แบบประเมิน" };

export default async function EvaluationTemplatesPage() {
  await requirePagePermission("campaign:read");

  return (
    <div className="space-y-6">
      <PageHeader title="แบบประเมิน" description="สร้างและจัดการแบบประเมินที่ใช้กับรอบประเมินผล" />
      <TemplateListView />
    </div>
  );
}
