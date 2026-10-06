import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MyResultsView } from "@/features/appraisal-round/my-results-view";

export const metadata: Metadata = { title: "ผลประเมินของฉัน" };

/** Open to any signed-in person: the API only returns their own published results. */
export default function AppraisalMyResultsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="ผลประเมินของฉัน" description="ผลที่ประกาศแล้ว" />
      <MyResultsView />
    </div>
  );
}
