import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AiEvaluationView } from "@/features/ai/ai-evaluation-view";

export const metadata: Metadata = { title: "แบบประเมิน (AI)" };

export default async function AiEvaluationPage() {
  await requirePagePermission("ai:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="แบบประเมิน (AI)"
        description="ให้ AI ออกแบบเกณฑ์การประเมินที่ตรงกับฝ่ายและสายงานของพนักงานแต่ละคน"
      />
      <AiEvaluationView />
    </div>
  );
}
