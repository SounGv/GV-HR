import { api, type Envelope } from "@/lib/api/client";
import type { DevelopmentItemFormValues, DevelopmentPlan, GapSuggestion } from "./types";

export function fetchMyPlan(cycle?: string) {
  const params = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
  return api.get<Envelope<DevelopmentPlan>>(`/api/development-plans/me${params}`);
}

export function fetchSuggestions() {
  return api.get<Envelope<GapSuggestion[]>>("/api/development-plans/suggestions");
}

export function fetchTeamPlans(cycle?: string) {
  const params = cycle ? `?cycle=${encodeURIComponent(cycle)}` : "";
  return api.get<Envelope<DevelopmentPlan[]>>(`/api/development-plans/team${params}`);
}

export function fetchEmployeePlan(employeeId: string, cycle: string) {
  return api.get<Envelope<DevelopmentPlan | null>>(
    `/api/development-plans/employee/${employeeId}?cycle=${encodeURIComponent(cycle)}`,
  );
}

export function addItem(planId: string, input: DevelopmentItemFormValues) {
  return api.post<Envelope<DevelopmentPlan>>(`/api/development-plans/${planId}/items`, input);
}

export function updateItem(itemId: string, input: Partial<DevelopmentItemFormValues> & { status?: string }) {
  return api.patch<Envelope<DevelopmentPlan>>(`/api/development-plans/items/${itemId}`, input);
}

export function addProgressNote(itemId: string, note: string) {
  return api.post<Envelope<DevelopmentPlan>>(`/api/development-plans/items/${itemId}/notes`, { note });
}

export function deleteItem(itemId: string) {
  return api.del<Envelope<DevelopmentPlan>>(`/api/development-plans/items/${itemId}`);
}
