import { api, type Envelope } from "@/lib/api/client";
import type { LeaveBalance, LeaveFormValues, LeaveRequest, LeaveScope, LeaveStatus } from "./types";

export function fetchLeave(scope: LeaveScope, status?: LeaveStatus) {
  const params = new URLSearchParams({ scope });
  if (status) params.set("status", status);
  return api.get<Envelope<LeaveRequest[]>>(`/api/leave?${params.toString()}`);
}

export function createLeave(input: LeaveFormValues) {
  return api.post<Envelope<LeaveRequest>>("/api/leave", input);
}

export function decideLeave(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<LeaveRequest>>(`/api/leave/${id}/decide`, { action, note });
}

export function cancelLeave(id: string) {
  return api.post<Envelope<LeaveRequest>>(`/api/leave/${id}/cancel`);
}

export function fetchBalances() {
  return api.get<Envelope<LeaveBalance[]>>("/api/leave/balances");
}
