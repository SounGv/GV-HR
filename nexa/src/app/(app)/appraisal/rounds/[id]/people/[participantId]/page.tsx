import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { ParticipantResultPage } from "@/features/appraisal-round/round-tracking";

export const metadata: Metadata = { title: "ผลรายคน" };

export default async function AppraisalParticipantPage({ params }: { params: Promise<{ id: string; participantId: string }> }) {
  await requirePagePermission("campaign:manage");
  const { id, participantId } = await params;
  return <ParticipantResultPage roundId={id} participantId={participantId} />;
}
