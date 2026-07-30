"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEmployee,
  deleteEmployee,
  fetchEmployee,
  fetchEmployees,
  fetchOrgOptions,
  updateEmployee,
} from "./api";
import type { EmployeeFormValues, EmployeeQuery } from "./types";

export const employeeKeys = {
  all: ["employees"] as const,
  list: (query: EmployeeQuery) => ["employees", "list", query] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
  orgOptions: ["org", "options"] as const,
};

export function useEmployees(query: EmployeeQuery) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => fetchEmployees(query),
    placeholderData: (prev) => prev, // keep previous page during pagination
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ""),
    queryFn: () => fetchEmployee(id!),
    enabled: !!id,
  });
}

export function useOrgOptions() {
  return useQuery({
    queryKey: employeeKeys.orgOptions,
    queryFn: fetchOrgOptions,
    staleTime: 5 * 60_000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeFormValues) => createEmployee(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EmployeeFormValues>) => updateEmployee(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.all });
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}
