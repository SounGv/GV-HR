import { api, type Envelope } from "@/lib/api/client";
import type { CompetencyCategory, CompetencyCategoryFormValues } from "./types";

export function fetchCompetencyCategories() {
  return api.get<Envelope<CompetencyCategory[]>>("/api/competency-categories");
}

export function fetchCompetencyCategory(id: string) {
  return api.get<Envelope<CompetencyCategory>>(`/api/competency-categories/${id}`);
}

export function createCompetencyCategory(input: CompetencyCategoryFormValues) {
  return api.post<Envelope<CompetencyCategory>>("/api/competency-categories", input);
}

export function updateCompetencyCategory(id: string, input: Partial<CompetencyCategoryFormValues>) {
  return api.patch<Envelope<CompetencyCategory>>(`/api/competency-categories/${id}`, input);
}

export function deleteCompetencyCategory(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/competency-categories/${id}`);
}
