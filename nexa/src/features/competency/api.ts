import { api, type Envelope } from "@/lib/api/client";
import type { Competency, CompetencyFormValues } from "./types";

export function fetchCompetencies(includeInactive?: boolean) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api.get<Envelope<Competency[]>>(`/api/competencies${qs}`);
}

export function fetchCompetency(id: string) {
  return api.get<Envelope<Competency>>(`/api/competencies/${id}`);
}

export function createCompetency(input: CompetencyFormValues) {
  return api.post<Envelope<Competency>>("/api/competencies", input);
}

export function updateCompetency(id: string, input: Partial<CompetencyFormValues>) {
  return api.patch<Envelope<Competency>>(`/api/competencies/${id}`, input);
}

export function deleteCompetency(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/competencies/${id}`);
}
