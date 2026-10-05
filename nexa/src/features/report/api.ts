import { api, type Envelope } from "@/lib/api/client";
import type { ReportType } from "./schema";
import type { ReportResult } from "./types";

export interface ReportParams {
  type: ReportType;
  from?: string;
  to?: string;
  departmentId?: string;
  employmentType?: string;
  employeeId?: string[];
  branchId?: string[];
  costCenterId?: string[];
}

export function fetchReport(q: ReportParams) {
  const params = new URLSearchParams({ type: q.type });
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  if (q.departmentId) params.set("departmentId", q.departmentId);
  if (q.employmentType) params.set("employmentType", q.employmentType);
  for (const id of q.employeeId ?? []) params.append("employeeId", id);
  for (const id of q.branchId ?? []) params.append("branchId", id);
  for (const id of q.costCenterId ?? []) params.append("costCenterId", id);
  return api.get<Envelope<ReportResult>>(`/api/reports?${params.toString()}`);
}
