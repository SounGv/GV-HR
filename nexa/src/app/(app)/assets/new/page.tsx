import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AssetFormPage } from "@/features/asset/asset-form-page";

export const metadata: Metadata = { title: "เพิ่มทรัพย์สิน" };

export default async function NewAssetPage() {
  await requirePagePermission("asset:create");
  return <AssetFormPage />;
}
