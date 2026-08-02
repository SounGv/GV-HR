import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CostCenterFormPage } from "@/features/cost-center/cost-center-form-page";

export const metadata: Metadata = { title: "เพิ่มศูนย์ต้นทุน" };

export default async function NewCostCenterPage() {
  await requirePagePermission("admin:update");
  return <CostCenterFormPage />;
}
