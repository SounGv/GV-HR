import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getUser } from "@/features/admin/service";
import { UserRolesFormPage } from "@/features/admin/user-roles-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขบทบาทผู้ใช้" };

export default async function UserRolesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("admin:update");
  const { id } = await params;

  const user = await getUser(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return <UserRolesFormPage user={user} />;
}
