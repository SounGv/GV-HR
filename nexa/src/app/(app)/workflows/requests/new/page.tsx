import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { RequestFormPage } from "@/features/workflow/request-form-page";

export const metadata: Metadata = { title: "ส่งคำขออนุมัติ" };

export default async function NewRequestPage() {
  await requirePagePermission("workflow:read");
  return <RequestFormPage />;
}
