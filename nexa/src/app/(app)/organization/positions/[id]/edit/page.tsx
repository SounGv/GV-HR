import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getPosition } from "@/features/organization/service";
import { PositionFormPage } from "@/features/organization/position-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขตำแหน่ง" };

export default async function EditPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("employee:update");
  const { id } = await params;

  const p = await getPosition(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <PositionFormPage position={p} />;
}
