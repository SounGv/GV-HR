"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  fetchRequests,
  createRequest,
  decideRequest,
  cancelRequest,
} from "./api";
import type { WorkflowFormValues, RequestFormValues, RequestScope } from "./types";

export const workflowKeys = {
  all: ["workflows"] as const,
  defs: (activeOnly: boolean) => ["workflows", "defs", activeOnly] as const,
  requests: (scope: RequestScope) => ["workflows", "requests", scope] as const,
};

export function useWorkflows(activeOnly = false) {
  return useQuery({ queryKey: workflowKeys.defs(activeOnly), queryFn: () => fetchWorkflows(activeOnly) });
}

export function useRequests(scope: RequestScope) {
  return useQuery({
    queryKey: workflowKeys.requests(scope),
    queryFn: () => fetchRequests(scope),
    placeholderData: (prev) => prev,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: workflowKeys.all });
}

export function useCreateWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: WorkflowFormValues) => createWorkflow(i), onSuccess: invalidate });
}

export function useUpdateWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<WorkflowFormValues> }) => updateWorkflow(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkflow() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteWorkflow(id), onSuccess: invalidate });
}

export function useCreateRequest() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: RequestFormValues) => createRequest(i), onSuccess: invalidate });
}

export function useDecideRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideRequest(v.id, v.action, v.note),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => cancelRequest(id), onSuccess: invalidate });
}
