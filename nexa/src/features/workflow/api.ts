import { api, type Envelope } from "@/lib/api/client";
import type {
  ApprovalWorkflow,
  ApprovalRequest,
  WorkflowFormValues,
  RequestFormValues,
  RequestScope,
} from "./types";

export function fetchWorkflows(activeOnly = false) {
  return api.get<Envelope<ApprovalWorkflow[]>>(`/api/workflows${activeOnly ? "?active=1" : ""}`);
}

export function createWorkflow(input: WorkflowFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/workflows", input);
}

export function updateWorkflow(id: string, input: Partial<WorkflowFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/workflows/${id}`, input);
}

export function deleteWorkflow(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/workflows/${id}`);
}

export function fetchRequests(scope: RequestScope) {
  return api.get<Envelope<ApprovalRequest[]>>(`/api/workflows/requests?scope=${scope}`);
}

export function createRequest(input: RequestFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/workflows/requests", input);
}

export function decideRequest(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<ApprovalRequest>>(`/api/workflows/requests/${id}/decide`, {
    action,
    note,
  });
}

export function cancelRequest(id: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/workflows/requests/${id}/cancel`, {});
}
