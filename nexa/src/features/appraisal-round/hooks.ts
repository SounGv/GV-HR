"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeRound,
  createRound,
  deleteRound,
  fetchCandidates,
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
