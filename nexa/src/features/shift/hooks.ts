"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  fetchAssignments,
  upsertAssignment,
  deleteAssignment,
} from "./api";
import type { TemplateFormValues } from "./types";

export const shiftKeys = {
  all: ["shifts"] as const,
  templates: ["shifts", "templates"] as const,
  assignments: (from: string, to: string) => ["shifts", "assignments", from, to] as const,
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
