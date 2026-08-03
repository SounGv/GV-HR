import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getWorkflow } from "@/features/workflow/service";
import { WorkflowFormPage } from "@/features/workflow/workflow-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขเวิร์กโฟลว์" };

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("workflow:update");
  const { id } = await params;

  const wf = await getWorkflow(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <WorkflowFormPage workflow={wf} />;
}
