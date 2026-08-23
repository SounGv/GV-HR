import { api, type Envelope } from "@/lib/api/client";
import type { Competency, CompetencyFormValues } from "./types";

export interface CompetencyFilters {
  includeInactive?: boolean;
  search?: string;
  categoryId?: string;
  departmentId?: string;
  positionId?: string;
  evaluationType?: string;
}

export function fetchCompetencies(filters?: CompetencyFilters) {
  const params = new URLSearchParams();
  if (filters?.includeInactive) params.set("includeInactive", "true");
  if (filters?.search) params.set("search", filters.search);
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.departmentId) params.set("departmentId", filters.departmentId);
  if (filters?.positionId) params.set("positionId", filters.positionId);
  if (filters?.evaluationType) params.set("evaluationType", filters.evaluationType);
  const qs = params.toString();
  return api.get<Envelope<Competency[]>>(`/api/competencies${qs ? `?${qs}` : ""}`);
}

export function fetchCompetency(id: string) {
  return api.get<Envelope<Competency>>(`/api/competencies/${id}`);
}

export function fetchCompetencyUsage(id: string) {
  return api.get<
    Envelope<{
      campaigns: { id: string; name: string; cycle: string; status: string }[];
      templates: { id: string; name: string; status: string; version: number }[];
    }>
  >(`/api/competencies/${id}/usage`);
}

export function createCompetency(input: CompetencyFormValues) {
  return api.post<Envelope<Competency>>("/api/competencies", input);
}

export function updateCompetency(id: string, input: Partial<CompetencyFormValues>) {
  return api.patch<Envelope<Competency>>(`/api/competencies/${id}`, input);
}

export function duplicateCompetency(id: string) {
  return api.post<Envelope<Competency>>(`/api/competencies/${id}/duplicate`);
}

export function deleteCompetency(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/competencies/${id}`);
}
