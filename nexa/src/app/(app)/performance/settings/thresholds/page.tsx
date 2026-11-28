import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { EvaluationThresholdsForm } from "@/features/campaign/evaluation-thresholds-form";
import { EvaluationRaterWeightsForm } from "@/features/campaign/evaluation-rater-weights-form";

export const metadata: Metadata = { title: "เกณฑ์คะแนนประเมินผล" };

export default async function EvaluationThresholdsPage() {
  await requirePagePermission("campaign:update");

  return (
    <div className="space-y-6">
      <PageHeader
        title="เกณฑ์คะแนนประเมินผล (ระบบเดิม)"
        description="ใช้กับแคมเปญประเมินแบบเดิมเท่านั้น รอบประเมินใหม่ไม่ใช้ค่าในหน้านี้ ให้ตั้งที่เมนู ประเมิน แล้วเลือก ตั้งค่า"
      />
      <EvaluationThresholdsForm />
      <EvaluationRaterWeightsForm />
    </div>
  );
}
