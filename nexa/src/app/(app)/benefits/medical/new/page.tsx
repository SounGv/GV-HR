import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { MedicalClaimForm } from "@/features/expense/medical-claim-form";

export const metadata: Metadata = { title: "ยื่นเบิกค่ารักษาพยาบาล" };

export default async function NewMedicalClaimPage() {
  await requirePagePermission("expense:read");
  return <MedicalClaimForm />;
}
