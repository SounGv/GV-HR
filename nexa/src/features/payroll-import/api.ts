import { api, type Envelope } from "@/lib/api/client";
import type { ImportSummary } from "@/features/employee-import/schema";

export function importPayrollAdjustmentsApi(rows: Record<string, unknown>[]) {
  return api.post<Envelope<ImportSummary>>("/api/payroll/import", { rows });
}
