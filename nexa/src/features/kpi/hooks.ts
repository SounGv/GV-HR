"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGoal,
  deleteGoal,
  fetchGoals,
  updateGoal,
  updateGoalProgress,
} from "./api";
import type { GoalFormValues, GoalScope, GoalStatus } from "./types";

export const kpiKeys = {
  all: ["kpi"] as const,
  list: (scope: GoalScope, cycle?: string, status?: GoalStatus) =>
    ["kpi", "list", scope, cycle, status] as const,
};

export function useGoals(scope: GoalScope, cycle?: string, status?: GoalStatus) {
  return useQuery({
    queryKey: kpiKeys.list(scope, cycle, status),
    queryFn: () => fetchGoals(scope, cycle, status),
    placeholderData: (prev) => prev,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalFormValues) => createGoal(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.all }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<GoalFormValues> }) => updateGoal(v.id, v.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.all }),
  });
}

export function useUpdateGoalProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; currentValue: string; status?: GoalStatus }) =>
      updateGoalProgress(v.id, v.currentValue, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKeys.all }),
  });
}
