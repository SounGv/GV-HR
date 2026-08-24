"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLoans,
  fetchLoan,
  fetchLoanEligibility,
  createLoan,
  decideLoan,
  payLoan,
  repayLoan,
  cancelLoan,
} from "./api";
import type { LoanFormValues, LoanScope, LoanStatus } from "./types";

export const loanKeys = {
  all: ["company-loans"] as const,
  list: (scope: LoanScope, status?: LoanStatus) => ["company-loans", "list", scope, status] as const,
  detail: (id: string) => ["company-loans", "detail", id] as const,
  eligibility: ["company-loans", "eligibility"] as const,
};

export function useLoans(scope: LoanScope, status?: LoanStatus) {
  return useQuery({ queryKey: loanKeys.list(scope, status), queryFn: () => fetchLoans(scope, status), placeholderData: (prev) => prev });
}

export function useLoan(id: string) {
  return useQuery({ queryKey: loanKeys.detail(id), queryFn: () => fetchLoan(id), enabled: !!id });
}

export function useLoanEligibility() {
  return useQuery({ queryKey: loanKeys.eligibility, queryFn: fetchLoanEligibility });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: loanKeys.all });
}

export function useCreateLoan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: LoanFormValues) => createLoan(i), onSuccess: invalidate });
}

export function useDecideLoan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) => decideLoan(v.id, v.action, v.note),
    onSuccess: invalidate,
  });
}

export function usePayLoan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => payLoan(id), onSuccess: invalidate });
}

export function useRepayLoan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (v: { id: string; amount: number }) => repayLoan(v.id, v.amount), onSuccess: invalidate });
}

export function useCancelLoan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cancelLoan(id), onSuccess: invalidate });
}
