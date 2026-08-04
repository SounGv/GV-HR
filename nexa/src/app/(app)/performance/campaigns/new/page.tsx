import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CampaignFormPage } from "@/features/campaign/campaign-form-page";

export const metadata: Metadata = { title: "สร้างแคมเปญประเมินผล" };

export default async function NewCampaignPage() {
  await requirePagePermission("campaign:create");
  return <CampaignFormPage />;
}
