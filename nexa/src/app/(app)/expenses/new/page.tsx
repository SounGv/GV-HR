import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { ExpenseFormPage } from "@/features/expense/expense-form-page";

export const metadata: Metadata = { title: "ขอเบิกจ่ายใหม่" };

export default async function NewExpensePage() {
  await requirePagePermission("expense:read");
  return <ExpenseFormPage />;
}
