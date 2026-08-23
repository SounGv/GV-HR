import { api, type Envelope } from "@/lib/api/client";
import type {
  AiDesignerRequest,
  AiDesignerResponse,
  BulkUpsertCompetencyResult,
  CampaignDetail,
  CampaignFormValues,
  CampaignListItem,
  CloneCampaignValues,
  EmployeeEvaluationHistoryItem,
  EvaluationThresholds,
  MyEvaluationAssignment,
  MyPendingResponse,
  ParticipantDetail,
  SaveDraftValues,
  SubmitResponseValues,
} from "./types";

export function fetchCampaigns(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return api.get<Envelope<CampaignListItem[]>>(`/api/campaigns${qs}`);
}

export function fetchCampaign(id: string) {
  return api.get<Envelope<CampaignDetail>>(`/api/campaigns/${id}`);
}

export function createCampaign(input: CampaignFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/campaigns", input);
}

export function updateCampaign(id: string, input: Partial<CampaignFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/campaigns/${id}`, input);
}

export function deleteCampaign(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/campaigns/${id}`);
}

export function addParticipants(campaignId: string, employeeIds: string[]) {
  return api.post<Envelope<{ participantIds: string[] }>>(`/api/campaigns/${campaignId}/participants`, {
    employeeIds,
  });
}

export function fetchParticipant(participantId: string) {
  return api.get<Envelope<ParticipantDetail>>(`/api/campaigns/participants/${participantId}`);
}

export function submitMyResponse(participantId: string, input: SubmitResponseValues) {
  return api.post<Envelope<{ ok: true; raterType: string }>>(
    `/api/campaigns/participants/${participantId}/respond`,
    input,
  );
}

export function finalizeParticipant(participantId: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/campaigns/participants/${participantId}/finalize`);
}

export function saveDraftResponse(participantId: string, input: SaveDraftValues) {
  return api.post<Envelope<{ ok: true }>>(`/api/campaigns/participants/${participantId}/draft`, input);
}

export function acknowledgeResult(participantId: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/campaigns/participants/${participantId}/acknowledge`);
}

export function requestReopen(responseId: string, note: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/campaigns/responses/${responseId}/reopen-request`, { note });
}

export function approveReopen(responseId: string) {
  return api.post<Envelope<{ ok: true }>>(`/api/campaigns/responses/${responseId}/reopen-approve`);
}

export function cloneCampaign(campaignId: string, input: CloneCampaignValues) {
  return api.post<Envelope<{ id: string }>>(`/api/campaigns/${campaignId}/clone`, input);
}

export function fetchEvaluationThresholds() {
  return api.get<Envelope<EvaluationThresholds>>("/api/campaigns/settings/thresholds");
}

export function updateEvaluationThresholds(input: EvaluationThresholds) {
  return api.patch<Envelope<EvaluationThresholds>>("/api/campaigns/settings/thresholds", input);
}

export function inviteRater(participantId: string, input: { raterType: "PEER" | "UPWARD" | "HR_EXEC"; raterEmployeeId: string }) {
  return api.post<Envelope<{ id: string }>>(`/api/campaigns/participants/${participantId}/raters`, input);
}

export function removeRater(responseId: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/campaigns/responses/${responseId}`);
}

export function fetchMyPendingResponses() {
  return api.get<Envelope<MyPendingResponse[]>>("/api/campaigns/my-pending");
}

export function fetchMyEvaluationAssignments() {
  return api.get<Envelope<MyEvaluationAssignment[]>>("/api/campaigns/my-assignments");
}

export function fetchEmployeeEvaluationHistory(employeeId: string) {
  return api.get<Envelope<EmployeeEvaluationHistoryItem[]>>(`/api/campaigns/employee-history/${employeeId}`);
}

export function generateAiDesign(input: AiDesignerRequest) {
  return api.post<Envelope<AiDesignerResponse>>("/api/ai/campaign-designer", input);
}

export function bulkUpsertCompetencies(items: { name: string; description?: string; weight: number }[]) {
  return api.post<Envelope<BulkUpsertCompetencyResult[]>>("/api/competencies/bulk-upsert", { items });
}
