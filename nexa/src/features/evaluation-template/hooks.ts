"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  deleteTemplate,
  fetchTemplate,
  fetchTemplates,
  generateAiTemplateDesign,
  updateTemplate,
} from "./api";
import type { AiTemplateDesignerRequest, TemplateFormValues } from "./types";

export const evaluationTemplateKeys = {
  all: ["evaluation-templates"] as const,
  list: (status?: string) => ["evaluation-templates", "list", status ?? "all"] as const,
  detail: (id: string) => ["evaluation-templates", "detail", id] as const,
};

export function useEvaluationTemplates(status?: string) {
  return useQuery({
    queryKey: evaluationTemplateKeys.list(status),
    queryFn: () => fetchTemplates(status),
    placeholderData: (prev) => prev,
  });
}

export function useEvaluationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: evaluationTemplateKeys.detail(id ?? ""),
    queryFn: () => fetchTemplate(id as string),
    enabled: !!id,
  });
}

export function useCreateEvaluationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateFormValues) => createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: evaluationTemplateKeys.all }),
  });
}

export function useUpdateEvaluationTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TemplateFormValues>) => updateTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: evaluationTemplateKeys.all }),
  });
}

export function useDeleteEvaluationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: evaluationTemplateKeys.all }),
  });
}

export function useGenerateAiTemplateDesign() {
  return useMutation({
    mutationFn: (input: AiTemplateDesignerRequest) => generateAiTemplateDesign(input),
  });
}
