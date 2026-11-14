import type { Metadata } from "next";
import { requirePageAnyPermission } from "@/lib/auth/page-guard";
import { RoundReviewPage } from "@/features/appraisal-round/review-view";

export const metadata: Metadata = { title: "ทบทวนผล" };

export default async function AppraisalRoundReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAnyPermission(["campaign:approve", "campaign:update"]);
  const { id } = await params;
  return <RoundReviewPage roundId={id} />;
}
