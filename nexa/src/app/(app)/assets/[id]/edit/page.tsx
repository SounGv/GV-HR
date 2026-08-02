import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getAsset } from "@/features/asset/service";
import { AssetFormPage } from "@/features/asset/asset-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขทรัพย์สิน" };

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("asset:update");
  const { id } = await params;

  const a = await getAsset(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <AssetFormPage
      asset={{
        id: a.id,
        assetCode: a.assetCode,
        name: a.name,
        category: a.category,
        serialNumber: a.serialNumber,
        status: a.status,
        assignedAt: a.assignedAt ? a.assignedAt.toISOString() : null,
        purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString() : null,
        purchasePrice: a.purchasePrice,
        note: a.note,
        assignedTo: a.assignedTo,
      }}
    />
  );
}
