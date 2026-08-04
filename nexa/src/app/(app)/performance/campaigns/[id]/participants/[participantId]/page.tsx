import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/api/errors";
import { getParticipant } from "@/features/campaign/service";
import { ParticipantDetailView } from "@/features/campaign/participant-detail-view";

export const metadata: Metadata = { title: "แบบประเมินผล" };

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const session = await requirePagePermission("campaign:read");
  const { participantId } = await params;

  await getParticipant(session.companyId, participantId, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });

  return <ParticipantDetailView participantId={participantId} />;
}
