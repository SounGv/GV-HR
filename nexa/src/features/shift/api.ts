import { api, type Envelope } from "@/lib/api/client";
import type { ShiftTemplate, ShiftAssignment, SwapRequest, TemplateFormValues } from "./types";

export function fetchTemplates() {
  return api.get<Envelope<ShiftTemplate[]>>("/api/shifts/templates");
}

export function createTemplate(input: TemplateFormValues) {
  return api.post<Envelope<ShiftTemplate>>("/api/shifts/templates", input);
}

export function updateTemplate(id: string, input: Partial<TemplateFormValues>) {
  return api.patch<Envelope<ShiftTemplate>>(`/api/shifts/templates/${id}`, input);
}

export function deleteTemplate(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/shifts/templates/${id}`);
}

export function fetchAssignments(from: string, to: string) {
  return api.get<Envelope<ShiftAssignment[]>>(`/api/shifts/assignments?from=${from}&to=${to}`);
}

export function fetchMyAssignments(from: string, to: string) {
  return api.get<Envelope<ShiftAssignment[]>>(`/api/shifts/assignments/mine?from=${from}&to=${to}`);
}

export function upsertAssignment(input: {
  employeeId: string;
  templateId: string;
  date: string;
  note?: string;
}) {
  return api.post<Envelope<{ id: string }>>("/api/shifts/assignments", input);
}

export function deleteAssignment(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/shifts/assignments/${id}`);
}

export function fetchSwapRequests(scope: "mine" | "inbox") {
  return api.get<Envelope<SwapRequest[]>>(`/api/shifts/swap-requests?scope=${scope}`);
}

export function createSwapRequest(input: { assignmentId: string; targetEmployeeId: string; reason?: string }) {
  return api.post<Envelope<SwapRequest>>("/api/shifts/swap-requests", input);
}

export function decideSwapRequest(id: string, action: "approve" | "reject", note?: string) {
  return api.post<Envelope<SwapRequest>>(`/api/shifts/swap-requests/${id}/decide`, { action, note });
}

export function cancelSwapRequest(id: string) {
  return api.post<Envelope<SwapRequest>>(`/api/shifts/swap-requests/${id}/cancel`);
}
