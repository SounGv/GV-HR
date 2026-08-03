import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getReview } from "@/features/performance/service";
import { ReviewFormPage } from "@/features/performance/review-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขการประเมิน" };

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("performance:update");
  const { id } = await params;

  const review = await getReview(session.companyId, session, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <ReviewFormPage
      review={{
        id: review.id,
        employee: {
          id: review.employee.id,
          firstName: review.employee.firstName,
          lastName: review.employee.lastName,
          employeeCode: review.employee.employeeCode,
        },
        cycle: review.cycle,
        competencies: review.competencies as { name: string; score: number }[],
        strengths: review.strengths,
        improvements: review.improvements,
        summary: review.summary,
      }}
    />
  );
}
