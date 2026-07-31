import { api, type Envelope } from "@/lib/api/client";
import type { ReportType } from "./schema";
import type { ReportResult } from "./types";

export function fetchReport(type: ReportType, period?: string) {
  const params = new URLSearchParams({ type });
  if (period) params.set("period", period);
  return api.get<Envelope<ReportResult>>(`/api/reports?${params.toString()}`);
}
