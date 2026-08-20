import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { CompetencyMatrixView } from "@/features/competency-matrix/matrix-view";

export const metadata: Metadata = { title: "Competency Matrix" };

export default async function CompetencyMatrixPage() {
  await requirePagePermission("campaign:update");

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[
          { label: "ประเมินผลงาน", href: "/performance" },
          { label: "เกณฑ์การประเมิน", href: "/performance/competencies" },
          { label: "Competency Matrix" },
        ]}
        backHref="/performance/competencies"
        title="Competency Matrix"
        description="กำหนดระดับสมรรถนะที่แต่ละตำแหน่งต้องมี ใช้เทียบกับระดับจริงของพนักงานแต่ละคน"
      />
      <CompetencyMatrixView />
    </div>
  );
}
