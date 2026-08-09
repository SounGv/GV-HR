import { api, type Envelope } from "@/lib/api/client";
import type { ImportSummary } from "@/features/employee-import/schema";

export function importPerformanceReviewsApi(rows: Record<string, unknown>[]) {
  return api.post<Envelope<ImportSummary>>("/api/performance/import", { rows });
}
