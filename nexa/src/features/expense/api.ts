import { api, type Envelope } from "@/lib/api/client";
import type { ExpenseClaim, ExpenseFormValues, ExpenseScope, ExpenseStatus } from "./types";

export function fetchExpenses(scope: ExpenseScope, status?: ExpenseStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<ExpenseClaim[]>>(`/api/expenses?${params.toString()}`);
}

export function createExpense(input: ExpenseFormValues) {
  return api.post<Envelope<ExpenseClaim>>("/api/expenses", input);
}

export function decideExpense(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<ExpenseClaim>>(`/api/expenses/${id}/decide`, { action, note });
}

export function payExpense(id: string) {
  return api.post<Envelope<ExpenseClaim>>(`/api/expenses/${id}/pay`, {});
}

export function cancelExpense(id: string) {
  return api.post<Envelope<ExpenseClaim>>(`/api/expenses/${id}/cancel`, {});
}
