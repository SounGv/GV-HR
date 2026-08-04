"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAuditEntities, fetchAuditLogs } from "./api";
import type { AuditLogQuery } from "./schema";

export function useAuditLogs(query: Partial<AuditLogQuery>) {
  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => fetchAuditLogs(query),
    placeholderData: (prev) => prev,
  });
}

export function useAuditEntities() {
  return useQuery({
    queryKey: ["audit-logs", "entities"],
    queryFn: () => fetchAuditEntities(),
  });
}
