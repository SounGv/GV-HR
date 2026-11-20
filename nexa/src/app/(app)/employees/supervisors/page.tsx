import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { SupervisorsView } from "@/features/employee/supervisors-view";

export const metadata: Metadata = { title: "หัวหน้างาน" };

export default async function SupervisorsPage() {
  const session = await requirePagePermission("employee:read");
  return (
    <div className="space-y-4">
      <PageHeader title="หัวหน้างาน" />
      <SupervisorsView canEdit={can(session.perms, "employee:update")} />
    </div>
  );
}
