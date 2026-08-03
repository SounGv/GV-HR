import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { ReviewFormPage } from "@/features/performance/review-form-page";

export const metadata: Metadata = { title: "สร้างการประเมิน" };

export default async function NewReviewPage() {
  await requirePagePermission("performance:create");
  return <ReviewFormPage />;
}
