import { api, type Envelope, type PaginatedEnvelope } from "@/lib/api/client";
import type { AuditLogQuery } from "./schema";
import type { AuditLogItem } from "./types";

function toQueryString(q: Partial<AuditLogQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function fetchAuditLogs(query: Partial<AuditLogQuery>) {
  return api.get<PaginatedEnvelope<AuditLogItem>>(`/api/admin/audit-logs${toQueryString(query)}`);
}

export function fetchAuditEntities() {
  return api.get<Envelope<string[]>>("/api/admin/audit-logs/entities");
}
