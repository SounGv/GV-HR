import { api, type Envelope } from "@/lib/api/client";
import type {
  Candidate,
  PublishedForm,
  RoundDetail,
  RoundListItem,
  RoundProgress,
  RoundSavePayload,
  TaskDetail,
  TaskItem,
} from "./types";

export const fetchRounds = () => api.get<Envelope<RoundListItem[]>>("/api/appraisal-rounds");
export const fetchRound = (id: string) => api.get<Envelope<RoundDetail>>(`/api/appraisal-rounds/${id}`);
export const fetchRoundProgress = (id: string) => api.get<Envelope<RoundProgress>>(`/api/appraisal-rounds/${id}/progress`);
export const fetchCandidates = () => api.get<Envelope<Candidate[]>>("/api/appraisal-rounds/candidates");
export const fetchPublishedForms = () => api.get<Envelope<PublishedForm[]>>("/api/appraisal-rounds/forms");
export const createRound = (name: string) => api.post<Envelope<{ id: string }>>("/api/appraisal-rounds", { name });
export const saveRound = (id: string, input: RoundSavePayload) =>
  api.patch<Envelope<{ id: string }>>(`/api/appraisal-rounds/${id}`, input);
export const openRound = (id: string) =>
  api.post<Envelope<{ id: string; mode: "NOW" | "SCHEDULED"; assignments: number; sent: { sent: number; failed: number } | null }>>(
    `/api/appraisal-rounds/${id}/open`,
  );
export const closeRound = (id: string) => api.post<Envelope<{ id: string }>>(`/api/appraisal-rounds/${id}/close`);
export const remindRound = (id: string) => api.post<Envelope<{ reminded: number }>>(`/api/appraisal-rounds/${id}/remind`);
export const deleteRound = (id: string) => api.del<Envelope<{ ok: true }>>(`/api/appraisal-rounds/${id}`);

export const fetchTasks = () => api.get<Envelope<TaskItem[]>>("/api/appraisal-tasks");
export const fetchTask = (id: string) => api.get<Envelope<TaskDetail>>(`/api/appraisal-tasks/${id}`);
export const saveTask = (id: string, input: { answers: { questionId: string; value: unknown }[]; submit: boolean }) =>
  api.put<Envelope<{ id: string; status: string; answered: number }>>(`/api/appraisal-tasks/${id}`, input);
