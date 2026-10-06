import type { Metadata } from "next";
import { TaskPage } from "@/features/appraisal-round/task-views";

export const metadata: Metadata = { title: "ทำแบบประเมิน" };

/** The API only returns a job to the rater it belongs to; anyone else gets "not found". */
export default async function AppraisalTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskPage id={id} />;
}
