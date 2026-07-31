"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as apiFns from "./api";
import type { CandidateFormValues, CandidateStage, JobFormValues, JobStatus } from "./types";

const keys = {
  jobs: (status?: JobStatus) => ["recruitment", "jobs", status] as const,
  candidates: (jobId?: string, stage?: CandidateStage) =>
    ["recruitment", "candidates", jobId, stage] as const,
  all: ["recruitment"] as const,
};

export function useJobs(status?: JobStatus) {
  return useQuery({ queryKey: keys.jobs(status), queryFn: () => apiFns.fetchJobs(status) });
}
export function useCandidates(jobId?: string, stage?: CandidateStage) {
  return useQuery({
    queryKey: keys.candidates(jobId, stage),
    queryFn: () => apiFns.fetchCandidates(jobId, stage),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.all });
}

export function useCreateJob() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (i: JobFormValues) => apiFns.createJob(i), onSuccess: inv });
}
export function useUpdateJob(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (i: Partial<JobFormValues>) => apiFns.updateJob(id, i), onSuccess: inv });
}
export function useDeleteJob() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiFns.deleteJob(id), onSuccess: inv });
}
export function useCreateCandidate() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (i: CandidateFormValues) => apiFns.createCandidate(i), onSuccess: inv });
}
export function useUpdateCandidate() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<CandidateFormValues> }) =>
      apiFns.updateCandidate(v.id, v.input),
    onSuccess: inv,
  });
}
export function useDeleteCandidate() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => apiFns.deleteCandidate(id), onSuccess: inv });
}
