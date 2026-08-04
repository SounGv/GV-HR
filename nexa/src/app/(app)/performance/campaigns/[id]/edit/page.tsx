import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCampaign } from "@/features/campaign/service";
import { CampaignFormPage } from "@/features/campaign/campaign-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขแคมเปญ" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("campaign:update");
  const { id } = await params;

  const campaign = await getCampaign(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <CampaignFormPage
      campaign={{
        id: campaign.id,
        name: campaign.name,
        cycle: campaign.cycle,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        status: campaign.status,
        aiGenerated: campaign.aiGenerated,
        aiRationale: campaign.aiRationale,
        competencies: campaign.competencies,
        participants: campaign.participants.map((p) => ({
          id: p.id,
          overallScore: p.overallScore,
          band: p.band,
          finalizedAt: p.finalizedAt?.toISOString() ?? null,
          employee: p.employee,
          responses: p.responses.map((r) => ({
            raterType: r.raterType,
            status: r.status,
            submittedAt: r.submittedAt?.toISOString() ?? null,
          })),
        })),
        participantCount: campaign.participantCount,
      }}
    />
  );
}
