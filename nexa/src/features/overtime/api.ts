import { api, type Envelope } from "@/lib/api/client";
import type { OtFormValues, OtScope, OtStatus, OvertimeRequest } from "./types";

export function fetchOvertime(scope: OtScope, status?: OtStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<OvertimeRequest[]>>(`/api/overtime?${params.toString()}`);
}

export function createOvertime(input: OtFormValues) {
  return api.post<Envelope<OvertimeRequest>>("/api/overtime", input);
}

export function decideOvertime(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<OvertimeRequest>>(`/api/overtime/${id}/decide`, { action, note });
}

export function cancelOvertime(id: string) {
  return api.post<Envelope<OvertimeRequest>>(`/api/overtime/${id}/cancel`);
}
