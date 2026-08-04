import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEmployee } from "@/features/employee/service";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { EvaluationHistoryView } from "@/features/campaign/evaluation-history-view";
import { fullName } from "@/lib/format";

export const metadata: Metadata = { title: "ประวัติการประเมิน" };

export default async function EmployeeEvaluationHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("campaign:read");
  const { id } = await params;

  const employee = await getEmployee(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  });
  const name = fullName(employee.firstName, employee.lastName);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "พนักงาน", href: "/employees" }, { label: name, href: `/employees/${employee.id}` }, { label: "ประวัติการประเมิน" }]}
        backHref={`/employees/${employee.id}`}
        title="ประวัติการประเมิน"
        description={name}
      />
      <EvaluationHistoryView employeeId={employee.id} />
    </div>
  );
}
