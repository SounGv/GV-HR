"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompetency,
  deleteCompetency,
  fetchCompetencies,
  fetchCompetency,
  updateCompetency,
} from "./api";
import type { CompetencyFormValues } from "./types";

export const competencyKeys = {
  all: ["competencies"] as const,
  list: (includeInactive?: boolean) => ["competencies", "list", includeInactive ?? false] as const,
  detail: (id: string) => ["competencies", "detail", id] as const,
};

export function useCompetencies(includeInactive?: boolean) {
  return useQuery({
    queryKey: competencyKeys.list(includeInactive),
    queryFn: () => fetchCompetencies(includeInactive),
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

export function useDeleteCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompetency(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}
