import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { LoanForm } from "@/features/company-loan/loan-form";

export const metadata: Metadata = { title: "ยื่นกู้เงินบริษัท" };

export default async function NewLoanPage() {
  await requirePagePermission("expense:read");
  return <LoanForm />;
}
