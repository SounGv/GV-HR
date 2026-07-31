import { api, type Envelope } from "@/lib/api/client";
import type { Goal, GoalFormValues, GoalScope, GoalStatus } from "./types";

export function fetchGoals(scope: GoalScope, cycle?: string, status?: GoalStatus) {
  const params = new URLSearchParams({ scope });
  if (cycle) params.set("cycle", cycle);
  if (status) params.set("status", status);
  return api.get<Envelope<Goal[]>>(`/api/kpi?${params.toString()}`);
}

export function createGoal(input: GoalFormValues) {
  return api.post<Envelope<Goal>>("/api/kpi", input);
}

export function updateGoal(id: string, input: Partial<GoalFormValues>) {
  return api.patch<Envelope<Goal>>(`/api/kpi/${id}`, input);
}

export function updateGoalProgress(id: string, currentValue: string, status?: GoalStatus) {
  return api.patch<Envelope<Goal>>(`/api/kpi/${id}`, { currentValue, status });
}

export function deleteGoal(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/kpi/${id}`);
}
