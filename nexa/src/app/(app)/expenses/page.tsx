import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { ExpenseView } from "@/features/expense/expense-view";

export const metadata: Metadata = { title: "เบิกจ่าย" };

export default async function ExpensesPage() {
  await requirePagePermission("expense:read");

  return (
    <div className="space-y-6">
      <PageHeader
        title="เบิกจ่ายค่าใช้จ่าย"
        description="ยื่นขอเบิกค่าใช้จ่าย ติดตามสถานะ อนุมัติ และบันทึกการจ่าย"
      />
      <ExpenseView />
    </div>
  );
}
