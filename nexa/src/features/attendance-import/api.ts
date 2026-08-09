import { api, type Envelope } from "@/lib/api/client";
import type { ImportSummary } from "@/features/employee-import/schema";

export function importAttendanceApi(rows: Record<string, unknown>[]) {
  return api.post<Envelope<ImportSummary>>("/api/attendance/import", { rows });
}
