import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { FormEditorPage } from "@/features/appraisal-form/form-editor";

export const metadata: Metadata = { title: "แก้ไขแบบประเมิน" };

export default async function AppraisalFormEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("campaign:manage");
  const { id } = await params;
  return <FormEditorPage id={id} />;
}
