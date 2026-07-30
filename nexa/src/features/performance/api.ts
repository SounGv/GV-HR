import { api, type Envelope } from "@/lib/api/client";
import type { PerformanceReview, ReviewFormValues, ReviewScope } from "./types";

export function fetchReviews(scope: ReviewScope) {
  return api.get<Envelope<PerformanceReview[]>>(`/api/performance?scope=${scope}`);
}

export function createReview(input: ReviewFormValues) {
  return api.post<Envelope<PerformanceReview>>("/api/performance", input);
}

export function updateReview(id: string, input: Partial<ReviewFormValues>) {
  return api.patch<Envelope<PerformanceReview>>(`/api/performance/${id}`, input);
}
