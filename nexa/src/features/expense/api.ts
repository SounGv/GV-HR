import { api, type Envelope } from "@/lib/api/client";
import type { ExpenseClaim, ExpenseFormValues, ExpenseScope, ExpenseStatus, MedicalBenefitSummary } from "./types";

export function fetchExpenses(scope: ExpenseScope, status?: ExpenseStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<ExpenseClaim[]>>(`/api/expenses?${params.toString()}`);
}

export function createExpense(input: ExpenseFormValues) {
  return api.post<Envelope<ExpenseClaim>>("/api/expenses", input);
}

export function submitExpense(id: string) {
  return api.post<Envelope<ExpenseClaim>>(`/api/expenses/${id}/submit`, {});
}

export function fetchMedicalSummary(year?: number) {
  const params = year ? `?year=${year}` : "";
  return api.get<Envelope<MedicalBenefitSummary & { eligible: boolean; passedProbation: boolean; completedOneYear: boolean }>>(
    `/api/expenses/medical-summary${params}`,
  );
}

export interface SickLeaveOption {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  attachmentUrl: string | null;
}

export function fetchSickLeaves() {
  return api.get<Envelope<SickLeaveOption[]>>("/api/expenses/sick-leaves");
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
