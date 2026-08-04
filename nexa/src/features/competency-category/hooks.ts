"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompetencyCategory,
  deleteCompetencyCategory,
  fetchCompetencyCategories,
  fetchCompetencyCategory,
  updateCompetencyCategory,
} from "./api";
import type { CompetencyCategoryFormValues } from "./types";

export const competencyCategoryKeys = {
  all: ["competency-categories"] as const,
  detail: (id: string) => ["competency-categories", "detail", id] as const,
};

export function useCompetencyCategories() {
  return useQuery({
    queryKey: competencyCategoryKeys.all,
    queryFn: () => fetchCompetencyCategories(),
    placeholderData: (prev) => prev,
  });
}

export function useCompetencyCategory(id: string) {
  return useQuery({
    queryKey: competencyCategoryKeys.detail(id),
    queryFn: () => fetchCompetencyCategory(id),
    enabled: !!id,
  });
}

export function useCreateCompetencyCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompetencyCategoryFormValues) => createCompetencyCategory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyCategoryKeys.all }),
  });
}

export function useUpdateCompetencyCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CompetencyCategoryFormValues>) => updateCompetencyCategory(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyCategoryKeys.all }),
  });
}

export function useDeleteCompetencyCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompetencyCategory(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: competencyCategoryKeys.all });
      qc.invalidateQueries({ queryKey: ["competencies"] });
      qc.removeQueries({ queryKey: competencyCategoryKeys.detail(id) });
    },
  });
}
