import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { JobFormPage } from "@/features/recruitment/job-form-page";

export const metadata: Metadata = { title: "ประกาศรับสมัคร" };

export default async function NewJobPage() {
  await requirePagePermission("recruitment:create");
  return <JobFormPage />;
}
