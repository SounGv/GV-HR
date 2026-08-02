import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCostCenter } from "@/features/cost-center/service";
import { CostCenterFormPage } from "@/features/cost-center/cost-center-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขศูนย์ต้นทุน" };

export default async function EditCostCenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("admin:update");
  const { id } = await params;

  const cc = await getCostCenter(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <CostCenterFormPage item={cc} />;
}
