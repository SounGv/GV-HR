import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { WorkflowFormPage } from "@/features/workflow/workflow-form-page";

export const metadata: Metadata = { title: "สร้างเวิร์กโฟลว์" };

export default async function NewWorkflowPage() {
  await requirePagePermission("workflow:create");
  return <WorkflowFormPage />;
}
