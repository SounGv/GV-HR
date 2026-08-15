"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addEmployeeDocument, fetchEmployeeDocuments, removeEmployeeDocument } from "./api";
import type { EmployeeDocumentCreateInput } from "./schema";

export const employeeDocumentKeys = {
  list: (employeeId: string) => ["employee-documents", employeeId] as const,
};

export function useEmployeeDocuments(employeeId: string) {
  return useQuery({
    queryKey: employeeDocumentKeys.list(employeeId),
    queryFn: () => fetchEmployeeDocuments(employeeId),
    enabled: !!employeeId,
  });
}

export function useAddEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeDocumentCreateInput) => addEmployeeDocument(employeeId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeDocumentKeys.list(employeeId) }),
  });
}

export function useRemoveEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => removeEmployeeDocument(employeeId, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeDocumentKeys.list(employeeId) }),
  });
}
