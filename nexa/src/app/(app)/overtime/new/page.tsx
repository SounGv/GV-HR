import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { OvertimeFormPage } from "@/features/overtime/overtime-form-page";

export const metadata: Metadata = { title: "ขอ OT ใหม่" };

export default async function NewOvertimePage() {
  await requirePagePermission("overtime:read");
  return <OvertimeFormPage />;
}
