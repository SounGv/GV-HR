import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TaskListView } from "@/features/appraisal-round/task-views";

export const metadata: Metadata = { title: "งานประเมินของฉัน" };

/** Open to any signed-in person: the list only ever contains their own jobs. */
export default function AppraisalTasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="งานประเมินของฉัน" description="คนที่คุณต้องประเมินในแต่ละรอบ" />
      <TaskListView />
    </div>
  );
}
