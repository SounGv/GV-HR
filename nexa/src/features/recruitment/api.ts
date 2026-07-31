import { api, type Envelope } from "@/lib/api/client";
import type {
  Candidate,
  CandidateFormValues,
  CandidateStage,
  Job,
  JobFormValues,
  JobStatus,
} from "./types";

export function fetchJobs(status?: JobStatus) {
  return api.get<Envelope<Job[]>>(`/api/recruitment/jobs${status ? `?status=${status}` : ""}`);
}
export function createJob(input: JobFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/recruitment/jobs", input);
}
export function updateJob(id: string, input: Partial<JobFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/recruitment/jobs/${id}`, input);
}
export function deleteJob(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/recruitment/jobs/${id}`);
}

export function fetchCandidates(jobPostingId?: string, stage?: CandidateStage) {
  const params = new URLSearchParams();
  if (jobPostingId) params.set("jobPostingId", jobPostingId);
  if (stage) params.set("stage", stage);
  const qs = params.toString();
  return api.get<Envelope<Candidate[]>>(`/api/recruitment/candidates${qs ? `?${qs}` : ""}`);
}
export function createCandidate(input: CandidateFormValues) {
  return api.post<Envelope<Candidate>>("/api/recruitment/candidates", input);
}
export function updateCandidate(id: string, input: Partial<CandidateFormValues>) {
  return api.patch<Envelope<Candidate>>(`/api/recruitment/candidates/${id}`, input);
}
export function deleteCandidate(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/recruitment/candidates/${id}`);
}
