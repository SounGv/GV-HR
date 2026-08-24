import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { LoanDetailView } from "@/features/company-loan/loan-detail-view";

export const metadata: Metadata = { title: "รายละเอียดคำขอกู้เงิน" };

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("expense:read");
  const { id } = await params;
  return <LoanDetailView loanId={id} />;
}
