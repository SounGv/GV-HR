import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CampaignWizard } from "@/features/campaign/campaign-wizard/campaign-wizard";

export const metadata: Metadata = { title: "สร้างรอบประเมิน" };

export default async function NewCampaignPage() {
  await requirePagePermission("campaign:create");
  return <CampaignWizard />;
}
