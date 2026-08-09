"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createReview, fetchDepartmentSummary, fetchReviews, updateReview } from "./api";
import type { ReviewFormValues, ReviewScope } from "./types";

export const performanceKeys = {
  all: ["performance"] as const,
  list: (scope: ReviewScope) => ["performance", "list", scope] as const,
  departmentSummary: ["performance", "department-summary"] as const,
};

export function useReviews(scope: ReviewScope) {
  return useQuery({
    queryKey: performanceKeys.list(scope),
    queryFn: () => fetchReviews(scope),
    placeholderData: (prev) => prev,
  });
}

export function useDepartmentSummary() {
  return useQuery({
    queryKey: performanceKeys.departmentSummary,
    queryFn: () => fetchDepartmentSummary(),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewFormValues) => createReview(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: performanceKeys.all }),
  });
}

export function useUpdateReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ReviewFormValues>) => updateReview(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: performanceKeys.all }),
  });
}
