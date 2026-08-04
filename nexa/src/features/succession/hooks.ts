"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlans,
  fetchPlan,
  createPlan,
  updatePlan,
  deletePlan,
  addCandidate,
  updateCandidate,
  removeCandidate,
} from "./api";
import type { PlanFormValues, SuccessionReadiness } from "./types";

export const successionKeys = {
  all: ["succession"] as const,
  plans: ["succession", "plans"] as const,
  plan: (id: string) => ["succession", "plans", id] as const,
};

export function usePlans() {
  return useQuery({ queryKey: successionKeys.plans, queryFn: fetchPlans });
}

export function usePlan(id: string) {
  return useQuery({ queryKey: successionKeys.plan(id), queryFn: () => fetchPlan(id), enabled: !!id });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: successionKeys.all });
}

export function useCreatePlan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: PlanFormValues) => createPlan(input), onSuccess: invalidate });
}

export function useUpdatePlan(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Partial<PlanFormValues>) => updatePlan(id, input),
    onSuccess: invalidate,
  });
}

export function useDeletePlan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deletePlan(id), onSuccess: invalidate });
}

export function useAddCandidate(planId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { employeeId: string; readiness: SuccessionReadiness; note?: string; rank?: number }) =>
      addCandidate(planId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCandidate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: { readiness?: SuccessionReadiness; note?: string; rank?: number } }) =>
      updateCandidate(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useRemoveCandidate() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => removeCandidate(id), onSuccess: invalidate });
}
