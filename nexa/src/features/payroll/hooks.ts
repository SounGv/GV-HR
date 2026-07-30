"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPayroll, generatePayroll, payPayroll } from "./api";
import type { PayrollScope } from "./types";

export const payrollKeys = {
  all: ["payroll"] as const,
  list: (scope: PayrollScope, period?: string) => ["payroll", "list", scope, period] as const,
};

export function usePayroll(scope: PayrollScope, period?: string) {
  return useQuery({
    queryKey: payrollKeys.list(scope, period),
    queryFn: () => fetchPayroll(scope, period),
    placeholderData: (prev) => prev,
  });
}

export function useGeneratePayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => generatePayroll(period),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}

export function usePayPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payPayroll(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: payrollKeys.all }),
  });
}
