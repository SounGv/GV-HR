"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cloneRound,
  closeRound,
  createRound,
  deleteRound,
  acknowledgeResult,
  approveResults,
  calculateRound,
  createProbationRound,
  fetchCandidates,
  fetchHrAssignment,
  fetchMyResults,
  fetchRoundResults,
  fetchSettings,
  publishResults,
  saveHrAssignment,
  saveSettings,
  fetchDepartmentProgress,
  fetchParticipantResult,
  fetchRoundMatrix,
  fetchPublishedForms,
  fetchRound,
  fetchRoundProgress,
  fetchRounds,
  fetchTask,
  fetchTasks,
  openRound,
  remindRound,
  unscheduleRound,
  saveRound,
  saveTask,
} from "./api";
import type { RoundSavePayload } from "./types";

export const appraisalRoundKeys = {
  all: ["appraisal-rounds"] as const,
  list: ["appraisal-rounds", "list"] as const,
  detail: (id: string) => ["appraisal-rounds", "detail", id] as const,
  progress: (id: string) => ["appraisal-rounds", "progress", id] as const,
  candidates: ["appraisal-rounds", "candidates"] as const,
  forms: ["appraisal-rounds", "forms"] as const,
  tasks: ["appraisal-tasks"] as const,
  task: (id: string) => ["appraisal-tasks", id] as const,
};

export const useRounds = () => useQuery({ queryKey: appraisalRoundKeys.list, queryFn: fetchRounds, placeholderData: (p) => p });
export const useRound = (id: string) => useQuery({ queryKey: appraisalRoundKeys.detail(id), queryFn: () => fetchRound(id) });
export const useRoundProgress = (id: string, enabled: boolean) =>
  useQuery({ queryKey: appraisalRoundKeys.progress(id), queryFn: () => fetchRoundProgress(id), enabled });
export const useCandidates = () => useQuery({ queryKey: appraisalRoundKeys.candidates, queryFn: fetchCandidates, staleTime: 60_000 });
export const usePublishedForms = () => useQuery({ queryKey: appraisalRoundKeys.forms, queryFn: fetchPublishedForms });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.all });
}

export function useCreateRound() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (name: string) => createRound(name), onSuccess: invalidate });
}
export function useSaveRound(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: RoundSavePayload) => saveRound(id, input), onSuccess: invalidate });
}
export function useOpenRound(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => openRound(id), onSuccess: invalidate });
}
export function useCloseRound(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => closeRound(id), onSuccess: invalidate });
}
export function useRemindRound(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => remindRound(id), onSuccess: invalidate });
}
export function useDeleteRound() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteRound(id), onSuccess: invalidate });
}

export const useTasks = () => useQuery({ queryKey: appraisalRoundKeys.tasks, queryFn: fetchTasks });
export const useTask = (id: string) => useQuery({ queryKey: appraisalRoundKeys.task(id), queryFn: () => fetchTask(id) });
export function useSaveTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { answers: { questionId: string; value: unknown }[]; submit: boolean }) => saveTask(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.tasks }),
  });
}

export const useRoundMatrix = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ["appraisal-rounds", "matrix", id], queryFn: () => fetchRoundMatrix(id), enabled });
export const useParticipantResult = (id: string, participantId: string) =>
  useQuery({ queryKey: ["appraisal-rounds", "result", id, participantId], queryFn: () => fetchParticipantResult(id, participantId) });

export function useUnscheduleRound(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => unscheduleRound(id), onSuccess: invalidate });
}

export const useDepartmentProgress = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ["appraisal-rounds", "departments", id], queryFn: () => fetchDepartmentProgress(id), enabled });

/** My unfinished evaluation jobs in open rounds (drives the menu badge and the "to do" rows). Accounts with no employee record just get an empty list. */
export function useMyPendingAppraisalTasks() {
  const q = useQuery({ queryKey: appraisalRoundKeys.tasks, queryFn: fetchTasks, retry: false, staleTime: 30_000 });
  const items = (q.data?.data ?? []).filter((t) => t.status !== "SUBMITTED" && t.roundStatus === "OPEN");
  return { items, isLoading: q.isLoading };
}

export function useCloneRound() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cloneRound(id), onSuccess: invalidate });
}

export const useSettings = () => useQuery({ queryKey: ["appraisal-settings"], queryFn: fetchSettings });
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: saveSettings, onSuccess: () => qc.invalidateQueries({ queryKey: ["appraisal-settings"] }) });
}
export const useRoundResults = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ["appraisal-rounds", "results", id], queryFn: () => fetchRoundResults(id), enabled });
export function useResultActions(id: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.all });
  return {
    calculate: useMutation({ mutationFn: () => calculateRound(id), onSuccess: done }),
    approve: useMutation({ mutationFn: () => approveResults(id), onSuccess: done }),
    publish: useMutation({ mutationFn: () => publishResults(id), onSuccess: done }),
  };
}
export const useMyResults = () => useQuery({ queryKey: ["appraisal-my-results"], queryFn: fetchMyResults, retry: false });
export function useAcknowledge() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (participantId: string) => acknowledgeResult(participantId), onSuccess: () => qc.invalidateQueries({ queryKey: ["appraisal-my-results"] }) });
}
export const useHrAssignment = (roundId: string, assignmentId: string) =>
  useQuery({ queryKey: ["appraisal-rounds", "hr-assignment", roundId, assignmentId], queryFn: () => fetchHrAssignment(roundId, assignmentId) });
export function useSaveHrAssignment(roundId: string, assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { answers: { questionId: string; value: unknown }[]; submit: boolean }) => saveHrAssignment(roundId, assignmentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.all }),
  });
}
export function useCreateProbationRound() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createProbationRound, onSuccess: () => qc.invalidateQueries({ queryKey: appraisalRoundKeys.all }) });
}
