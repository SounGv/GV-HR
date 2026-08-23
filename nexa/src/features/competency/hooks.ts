"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompetency,
  deleteCompetency,
  duplicateCompetency,
  fetchCompetencies,
  fetchCompetency,
  fetchCompetencyUsage,
  updateCompetency,
  type CompetencyFilters,
} from "./api";
import type { CompetencyFormValues } from "./types";

export const competencyKeys = {
  all: ["competencies"] as const,
  list: (filters?: CompetencyFilters) => ["competencies", "list", filters ?? {}] as const,
  detail: (id: string) => ["competencies", "detail", id] as const,
  usage: (id: string) => ["competencies", "usage", id] as const,
};

export function useCompetencies(filters?: CompetencyFilters) {
  return useQuery({
    queryKey: competencyKeys.list(filters),
    queryFn: () => fetchCompetencies(filters),
    placeholderData: (prev) => prev,
  });
}

export function useCompetency(id: string) {
  return useQuery({
    queryKey: competencyKeys.detail(id),
    queryFn: () => fetchCompetency(id),
    enabled: !!id,
  });
}

export function useCompetencyUsage(id: string | undefined) {
  return useQuery({
    queryKey: competencyKeys.usage(id ?? ""),
    queryFn: () => fetchCompetencyUsage(id as string),
    enabled: !!id,
  });
}

export function useCreateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompetencyFormValues) => createCompetency(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}

export function useUpdateCompetency(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CompetencyFormValues>) => updateCompetency(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}

export function useDuplicateCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateCompetency(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}

export function useDeleteCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompetency(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}
