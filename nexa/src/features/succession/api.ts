import { api, type Envelope } from "@/lib/api/client";
import type { PlanFormValues, SuccessionPlanDetail, SuccessionPlanListItem, SuccessionReadiness } from "./types";

export function fetchPlans() {
  return api.get<Envelope<SuccessionPlanListItem[]>>("/api/succession/plans");
}

export function fetchPlan(id: string) {
  return api.get<Envelope<SuccessionPlanDetail>>(`/api/succession/plans/${id}`);
}

export function createPlan(input: PlanFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/succession/plans", input);
}

export function updatePlan(id: string, input: Partial<PlanFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/succession/plans/${id}`, input);
}

export function deletePlan(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/succession/plans/${id}`);
}

export function addCandidate(
  planId: string,
  input: { employeeId: string; readiness: SuccessionReadiness; note?: string; rank?: number },
) {
  return api.post<Envelope<{ id: string }>>(`/api/succession/plans/${planId}/candidates`, input);
}

export function updateCandidate(
  candidateId: string,
  input: { readiness?: SuccessionReadiness; note?: string; rank?: number },
) {
  return api.patch<Envelope<{ id: string }>>(`/api/succession/candidates/${candidateId}`, input);
}

export function removeCandidate(candidateId: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/succession/candidates/${candidateId}`);
}
