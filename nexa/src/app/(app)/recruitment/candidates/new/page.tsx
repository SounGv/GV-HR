import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { CandidateFormPage } from "@/features/recruitment/candidate-form-page";

export const metadata: Metadata = { title: "เพิ่มผู้สมัคร" };

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  await requirePagePermission("recruitment:create");
  const { job } = await searchParams;
  return <CandidateFormPage defaultJobId={job} />;
}
