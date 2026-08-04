import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { RoleFormPage } from "@/features/admin/role-form-page";

export const metadata: Metadata = { title: "สร้างบทบาท" };

export default async function NewRolePage() {
  await requirePagePermission("admin:create");
  return <RoleFormPage />;
}
