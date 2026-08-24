"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchExpenses,
  createExpense,
  decideExpense,
  payExpense,
  cancelExpense,
  submitExpense,
  fetchMedicalSummary,
  fetchSickLeaves,
} from "./api";
import type { ExpenseFormValues, ExpenseScope, ExpenseStatus } from "./types";

export const expenseKeys = {
  all: ["expenses"] as const,
  list: (scope: ExpenseScope, status?: ExpenseStatus) =>
    ["expenses", "list", scope, status] as const,
  medicalSummary: (year?: number) => ["expenses", "medical-summary", year] as const,
  sickLeaves: ["expenses", "sick-leaves"] as const,
};

export function useExpenses(scope: ExpenseScope, status?: ExpenseStatus) {
  return useQuery({
    queryKey: expenseKeys.list(scope, status),
    queryFn: () => fetchExpenses(scope, status),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: expenseKeys.all });
}

export function useCreateExpense() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: ExpenseFormValues) => createExpense(i), onSuccess: invalidate });
}

export function useDecideExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideExpense(v.id, v.action, v.note),
    onSuccess: invalidate,
  });
}

export function usePayExpense() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => payExpense(id), onSuccess: invalidate });
}

export function useCancelExpense() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cancelExpense(id), onSuccess: invalidate });
}

export function useSubmitExpense() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => submitExpense(id), onSuccess: invalidate });
}

export function useMedicalSummary(year?: number) {
  return useQuery({
    queryKey: expenseKeys.medicalSummary(year),
    queryFn: () => fetchMedicalSummary(year),
  });
}

export function useSickLeaves() {
  return useQuery({ queryKey: expenseKeys.sickLeaves, queryFn: fetchSickLeaves });
}
