import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { TrainingView } from "@/features/training/training-view";

export const metadata: Metadata = { title: "อบรมและพัฒนา" };

export default async function TrainingPage() {
  await requirePagePermission("training:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="อบรมและพัฒนา"
        description="หลักสูตรอบรมภายในองค์กร ลงทะเบียนและติดตามการเรียนของคุณ"
      />
      <TrainingView />
    </div>
  );
}
