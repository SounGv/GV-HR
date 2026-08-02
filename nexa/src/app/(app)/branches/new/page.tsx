import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { BranchFormPage } from "@/features/branch/branch-form-page";

export const metadata: Metadata = { title: "เพิ่มสาขา" };

export default async function NewBranchPage() {
  await requirePagePermission("admin:update");
  return <BranchFormPage />;
}
