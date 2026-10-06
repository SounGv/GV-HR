import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { RoundPage } from "@/features/appraisal-round/round-wizard";

export const metadata: Metadata = { title: "รอบประเมิน" };

export default async function AppraisalRoundPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("campaign:manage");
  const { id } = await params;
  return <RoundPage id={id} />;
}
