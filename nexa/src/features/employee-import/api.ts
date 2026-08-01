import { api, type Envelope } from "@/lib/api/client";
import type { ImportSummary } from "./schema";

export function importEmployeesApi(rows: Record<string, unknown>[]) {
  return api.post<Envelope<ImportSummary>>("/api/employees/import", { rows });
}
