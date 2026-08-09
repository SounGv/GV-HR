import { api, type Envelope } from "@/lib/api/client";
import type { DepartmentSummaryRow, PerformanceReview, ReviewFormValues, ReviewScope } from "./types";

export function fetchReviews(scope: ReviewScope) {
  return api.get<Envelope<PerformanceReview[]>>(`/api/performance?scope=${scope}`);
}

export function fetchDepartmentSummary() {
  return api.get<Envelope<DepartmentSummaryRow[]>>("/api/performance/department-summary");
}

export function createReview(input: ReviewFormValues) {
  return api.post<Envelope<PerformanceReview>>("/api/performance", input);
}

export function updateReview(id: string, input: Partial<ReviewFormValues>) {
  return api.patch<Envelope<PerformanceReview>>(`/api/performance/${id}`, input);
}
