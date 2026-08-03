"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRecognition, fetchRecognition, fetchRecognitionSummary } from "./api";
import type { RecognitionFormValues, RecognitionScope } from "./types";

export const recognitionKeys = {
  all: ["recognition"] as const,
  list: (scope: RecognitionScope) => ["recognition", "list", scope] as const,
  summary: (employeeId: string) => ["recognition", "summary", employeeId] as const,
};

export function useRecognition(scope: RecognitionScope) {
  return useQuery({
    queryKey: recognitionKeys.list(scope),
    queryFn: () => fetchRecognition(scope),
    placeholderData: (prev) => prev,
  });
}

export function useRecognitionSummary(employeeId: string | undefined) {
  return useQuery({
    queryKey: recognitionKeys.summary(employeeId ?? ""),
    queryFn: () => fetchRecognitionSummary(employeeId as string),
    enabled: !!employeeId,
  });
}

export function useCreateRecognition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecognitionFormValues) => createRecognition(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: recognitionKeys.all }),
  });
}
