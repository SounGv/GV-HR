import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { HrFillPage } from "@/features/appraisal-round/task-views";

export const metadata: Metadata = { title: "กรอกแทนผู้ประเมิน" };

export default async function AppraisalHrFillPage({ params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  await requirePagePermission("campaign:update");
  const { id, assignmentId } = await params;
  return <HrFillPage roundId={id} assignmentId={assignmentId} />;
}
