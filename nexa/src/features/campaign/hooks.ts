"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeResult,
  addParticipants,
  approveReopen,
  bulkUpsertCompetencies,
  cloneCampaign,
  createCampaign,
  deleteCampaign,
  fetchCampaign,
  fetchCampaigns,
  fetchDashboard,
  fetchDashboardCycles,
  fetchEmployeeEvaluationHistory,
  fetchEvaluationThresholds,
  fetchMyEvaluationAssignments,
  fetchMyPendingResponses,
  fetchParticipant,
  finalizeParticipant,
  generateAiDesign,
  inviteRater,
  removeRater,
  requestReopen,
  saveDraftResponse,
  submitMyResponse,
  updateCampaign,
  updateEvaluationThresholds,
} from "./api";
import type {
  AiDesignerRequest,
  CampaignFormValues,
  CloneCampaignValues,
  DashboardFilters,
  EvaluationThresholds,
  SaveDraftValues,
  SubmitResponseValues,
} from "./types";
import { competencyKeys } from "@/features/competency/hooks";

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (status?: string) => ["campaigns", "list", status ?? "all"] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  participant: (id: string) => ["campaigns", "participant", id] as const,
  employeeHistory: (employeeId: string) => ["campaigns", "employee-history", employeeId] as const,
  myPending: ["campaigns", "my-pending"] as const,
  myAssignments: ["campaigns", "my-assignments"] as const,
  thresholds: ["campaigns", "thresholds"] as const,
  dashboard: (filters: DashboardFilters) => ["campaigns", "dashboard", filters] as const,
  dashboardCycles: ["campaigns", "dashboard-cycles"] as const,
};

export function useMyPendingResponses() {
  return useQuery({ queryKey: campaignKeys.myPending, queryFn: fetchMyPendingResponses });
}

/** Pending + submitted, with history — see getMyEvaluationAssignments for why this is separate from useMyPendingResponses. */
export function useMyEvaluationAssignments() {
  return useQuery({ queryKey: campaignKeys.myAssignments, queryFn: fetchMyEvaluationAssignments });
}

export function useCampaigns(status?: string) {
  return useQuery({
    queryKey: campaignKeys.list(status),
    queryFn: () => fetchCampaigns(status),
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => fetchCampaign(id),
    enabled: !!id,
  });
}

export function useParticipant(participantId: string | undefined) {
  return useQuery({
    queryKey: campaignKeys.participant(participantId ?? ""),
    queryFn: () => fetchParticipant(participantId as string),
    enabled: !!participantId,
  });
}

export function useEmployeeEvaluationHistory(employeeId: string | undefined) {
  return useQuery({
    queryKey: campaignKeys.employeeHistory(employeeId ?? ""),
    queryFn: () => fetchEmployeeEvaluationHistory(employeeId as string),
    enabled: !!employeeId,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignFormValues) => createCampaign(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CampaignFormValues>) => updateCampaign(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useAddParticipants(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeIds: string[]) => addParticipants(campaignId, employeeIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useSubmitMyResponse(participantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitResponseValues) => submitMyResponse(participantId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useFinalizeParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) => finalizeParticipant(participantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useSaveDraftResponse(participantId: string) {
  return useMutation({
    mutationFn: (input: SaveDraftValues) => saveDraftResponse(participantId, input),
  });
}

export function useAcknowledgeResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) => acknowledgeResult(participantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useRequestReopen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ responseId, note }: { responseId: string; note: string }) => requestReopen(responseId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useApproveReopen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (responseId: string) => approveReopen(responseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useCloneCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: CloneCampaignValues }) => cloneCampaign(campaignId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useDashboard(filters: DashboardFilters) {
  return useQuery({
    queryKey: campaignKeys.dashboard(filters),
    queryFn: () => fetchDashboard(filters),
    placeholderData: (prev) => prev,
  });
}

export function useDashboardCycles() {
  return useQuery({ queryKey: campaignKeys.dashboardCycles, queryFn: fetchDashboardCycles });
}

export function useEvaluationThresholds() {
  return useQuery({ queryKey: campaignKeys.thresholds, queryFn: fetchEvaluationThresholds });
}

export function useUpdateEvaluationThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EvaluationThresholds) => updateEvaluationThresholds(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.thresholds }),
  });
}

export function useInviteRater(participantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { raterType: "PEER" | "UPWARD" | "HR_EXEC"; raterEmployeeId: string }) => inviteRater(participantId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useRemoveRater() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (responseId: string) => removeRater(responseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useGenerateAiDesign() {
  return useMutation({
    mutationFn: (input: AiDesignerRequest) => generateAiDesign(input),
  });
}

export function useApplyAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; description?: string; weight: number }[]) => bulkUpsertCompetencies(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyKeys.all }),
  });
}
