"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  fetchAssignments,
  fetchMyAssignments,
  upsertAssignment,
  deleteAssignment,
  fetchSwapRequests,
  createSwapRequest,
  decideSwapRequest,
  cancelSwapRequest,
} from "./api";
import type { TemplateFormValues } from "./types";

export const shiftKeys = {
  all: ["shifts"] as const,
  templates: ["shifts", "templates"] as const,
  assignments: (from: string, to: string) => ["shifts", "assignments", from, to] as const,
  myAssignments: (from: string, to: string) => ["shifts", "assignments", "mine", from, to] as const,
  swapRequests: (scope: "mine" | "inbox") => ["shifts", "swap-requests", scope] as const,
};

export function useTemplates() {
  return useQuery({ queryKey: shiftKeys.templates, queryFn: fetchTemplates });
}

export function useAssignments(from: string, to: string) {
  return useQuery({
    queryKey: shiftKeys.assignments(from, to),
    queryFn: () => fetchAssignments(from, to),
    placeholderData: (prev) => prev,
  });
}

export function useMyAssignments(from: string, to: string) {
  return useQuery({
    queryKey: shiftKeys.myAssignments(from, to),
    queryFn: () => fetchMyAssignments(from, to),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: shiftKeys.all });
}

export function useCreateTemplate() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: TemplateFormValues) => createTemplate(i), onSuccess: invalidate });
}

export function useUpdateTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<TemplateFormValues> }) => updateTemplate(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteTemplate(id), onSuccess: invalidate });
}

export function useUpsertAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: { employeeId: string; templateId: string; date: string; note?: string }) =>
      upsertAssignment(i),
    onSuccess: invalidate,
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteAssignment(id), onSuccess: invalidate });
}

export function useSwapRequests(scope: "mine" | "inbox") {
  return useQuery({
    queryKey: shiftKeys.swapRequests(scope),
    queryFn: () => fetchSwapRequests(scope),
    placeholderData: (prev) => prev,
  });
}

export function useCreateSwapRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { assignmentId: string; targetEmployeeId: string; reason?: string }) =>
      createSwapRequest(input),
    onSuccess: invalidate,
  });
}

export function useDecideSwapRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideSwapRequest(v.id, v.action, v.note),
    onSuccess: invalidate,
  });
}

export function useCancelSwapRequest() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cancelSwapRequest(id), onSuccess: invalidate });
}
