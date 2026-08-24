import { api, type Envelope } from "@/lib/api/client";
import type { CompanyLoanRequest, LoanEligibility, LoanFormValues, LoanScope, LoanStatus } from "./types";

export function fetchLoans(scope: LoanScope, status?: LoanStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<CompanyLoanRequest[]>>(`/api/company-loans?${params.toString()}`);
}

export function fetchLoan(id: string) {
  return api.get<Envelope<CompanyLoanRequest>>(`/api/company-loans/${id}`);
}

export function fetchLoanEligibility() {
  return api.get<Envelope<LoanEligibility>>("/api/company-loans/eligibility");
}

export function createLoan(input: LoanFormValues) {
  return api.post<Envelope<CompanyLoanRequest>>("/api/company-loans", input);
}

export function decideLoan(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<CompanyLoanRequest>>(`/api/company-loans/${id}/decide`, { action, note });
}

export function payLoan(id: string) {
  return api.post<Envelope<CompanyLoanRequest>>(`/api/company-loans/${id}/pay`, {});
}

export function repayLoan(id: string, amount: number) {
  return api.post<Envelope<CompanyLoanRequest>>(`/api/company-loans/${id}/repay`, { amount });
}

export function cancelLoan(id: string) {
  return api.post<Envelope<CompanyLoanRequest>>(`/api/company-loans/${id}/cancel`, {});
}
