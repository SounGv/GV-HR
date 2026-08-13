"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addItem,
  addProgressNote,
  deleteItem,
  fetchEmployeePlan,
  fetchMyPlan,
  fetchSuggestions,
  fetchTeamPlans,
  updateItem,
} from "./api";
import type { DevelopmentItemFormValues } from "./types";

export const developmentPlanKeys = {
  all: ["development-plans"] as const,
  mine: (cycle?: string) => ["development-plans", "mine", cycle] as const,
  suggestions: ["development-plans", "suggestions"] as const,
  team: (cycle?: string) => ["development-plans", "team", cycle] as const,
  employee: (employeeId: string, cycle: string) => ["development-plans", "employee", employeeId, cycle] as const,
};

export function useMyPlan(cycle?: string) {
  return useQuery({ queryKey: developmentPlanKeys.mine(cycle), queryFn: () => fetchMyPlan(cycle) });
}

export function useGapSuggestions() {
  return useQuery({ queryKey: developmentPlanKeys.suggestions, queryFn: fetchSuggestions });
}

export function useTeamPlans(cycle?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: developmentPlanKeys.team(cycle),
    queryFn: () => fetchTeamPlans(cycle),
    enabled: options?.enabled ?? true,
  });
}

export function useEmployeePlan(employeeId: string, cycle: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: developmentPlanKeys.employee(employeeId, cycle),
    queryFn: () => fetchEmployeePlan(employeeId, cycle),
    enabled: options?.enabled ?? true,
  });
}

export function useAddDevelopmentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: string; input: DevelopmentItemFormValues }) => addItem(planId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: developmentPlanKeys.all }),
  });
}

export function useUpdateDevelopmentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: Partial<DevelopmentItemFormValues> & { status?: string } }) =>
      updateItem(itemId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: developmentPlanKeys.all }),
  });
}

export function useAddProgressNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, note }: { itemId: string; note: string }) => addProgressNote(itemId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: developmentPlanKeys.all }),
  });
}

export function useDeleteDevelopmentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: developmentPlanKeys.all }),
  });
}
