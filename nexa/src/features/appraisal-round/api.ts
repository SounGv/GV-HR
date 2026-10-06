import { api, type Envelope } from "@/lib/api/client";
import type {
  Candidate,
  DepartmentProgress,
  HrAssignmentDetail,
  MyResult,
  ResultRow,
  SettingsView,
  MatrixRow,
  ParticipantResult,
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
export const cloneRound = (id: string) => api.post<Envelope<{ id: string }>>(`/api/appraisal-rounds/${id}/clone`);
export const unscheduleRound = (id: string) => api.post<Envelope<{ id: string }>>(`/api/appraisal-rounds/${id}/unschedule`);
export const deleteRound = (id: string) => api.del<Envelope<{ ok: true }>>(`/api/appraisal-rounds/${id}`);

export const fetchTasks = () => api.get<Envelope<TaskItem[]>>("/api/appraisal-tasks");
export const fetchTask = (id: string) => api.get<Envelope<TaskDetail>>(`/api/appraisal-tasks/${id}`);
export const saveTask = (id: string, input: { answers: { questionId: string; value: unknown }[]; submit: boolean }) =>
  api.put<Envelope<{ id: string; status: string; answered: number }>>(`/api/appraisal-tasks/${id}`, input);

export const fetchRoundMatrix = (id: string) => api.get<Envelope<MatrixRow[]>>(`/api/appraisal-rounds/${id}/matrix`);
export const fetchParticipantResult = (id: string, participantId: string) =>
  api.get<Envelope<ParticipantResult>>(`/api/appraisal-rounds/${id}/people/${participantId}`);
export const fetchDepartmentProgress = (id: string) =>
  api.get<Envelope<DepartmentProgress[]>>(`/api/appraisal-rounds/${id}/departments`);

export const fetchSettings = () => api.get<Envelope<SettingsView>>("/api/appraisal-settings");
export const saveSettings = (input: Omit<SettingsView, "configured">) => api.put<Envelope<SettingsView>>("/api/appraisal-settings", input);
export const calculateRound = (id: string) =>
  api.post<Envelope<{ calculated: number; noAnswers: number; kept: number }>>(`/api/appraisal-rounds/${id}/calculate`);
export const approveResults = (id: string) => api.post<Envelope<{ approved: number }>>(`/api/appraisal-rounds/${id}/approve-results`, {});
export const publishResults = (id: string) =>
  api.post<Envelope<{ published: number; notified: number }>>(`/api/appraisal-rounds/${id}/publish-results`, {});
export const fetchRoundResults = (id: string) => api.get<Envelope<ResultRow[]>>(`/api/appraisal-rounds/${id}/results`);
export const fetchMyResults = () => api.get<Envelope<MyResult[]>>("/api/appraisal-my-results");
export const acknowledgeResult = (participantId: string) =>
  api.post<Envelope<{ id: string }>>(`/api/appraisal-my-results/${participantId}/acknowledge`);
export const fetchHrAssignment = (roundId: string, assignmentId: string) =>
  api.get<Envelope<HrAssignmentDetail>>(`/api/appraisal-rounds/${roundId}/assignments/${assignmentId}`);
export const saveHrAssignment = (roundId: string, assignmentId: string, input: { answers: { questionId: string; value: unknown }[]; submit: boolean }) =>
  api.put<Envelope<{ id: string; status: string; answered: number }>>(`/api/appraisal-rounds/${roundId}/assignments/${assignmentId}`, input);
export const createProbationRound = () => api.post<Envelope<{ id: string; participants: number }>>("/api/appraisal-rounds/probation");
