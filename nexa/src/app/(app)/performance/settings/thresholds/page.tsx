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
        title="เกณฑ์คะแนนประเมินผล"
        description="ตั้งค่าเกณฑ์สีของผลประเมินและน้ำหนักคะแนนต่อประเภทผู้ประเมิน — ใช้ทั่วทั้งระบบ ไม่ hardcode ในหน้าจอ"
      />
      <EvaluationThresholdsForm />
      <EvaluationRaterWeightsForm />
    </div>
  );
}
