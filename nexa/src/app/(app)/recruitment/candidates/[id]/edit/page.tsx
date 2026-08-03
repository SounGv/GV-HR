import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCandidate } from "@/features/recruitment/service";
import { CandidateFormPage } from "@/features/recruitment/candidate-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขผู้สมัคร" };

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("recruitment:update");
  const { id } = await params;

  const candidate = await getCandidate(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <CandidateFormPage
      candidate={{
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        note: candidate.note,
        stage: candidate.stage,
        jobPosting: candidate.jobPosting,
      }}
    />
  );
}
