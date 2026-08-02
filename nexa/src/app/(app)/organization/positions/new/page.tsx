import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PositionFormPage } from "@/features/organization/position-form-page";

export const metadata: Metadata = { title: "เพิ่มตำแหน่ง" };

export default async function NewPositionPage() {
  await requirePagePermission("employee:create");
  return <PositionFormPage />;
}
