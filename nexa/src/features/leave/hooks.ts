"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelLeave,
  createLeave,
  decideLeave,
  fetchBalances,
  fetchLeave,
} from "./api";
import type { LeaveFormValues, LeaveScope, LeaveStatus } from "./types";

export const leaveKeys = {
  all: ["leave"] as const,
  list: (scope: LeaveScope, status?: LeaveStatus) => ["leave", "list", scope, status] as const,
  balances: ["leave", "balances"] as const,
};

export function useLeave(scope: LeaveScope, status?: LeaveStatus) {
  return useQuery({
    queryKey: leaveKeys.list(scope, status),
    queryFn: () => fetchLeave(scope, status),
    placeholderData: (prev) => prev,
  });
}

export function useBalances() {
  return useQuery({ queryKey: leaveKeys.balances, queryFn: fetchBalances });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaveFormValues) => createLeave(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export function useDecideLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideLeave(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelLeave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaveKeys.all }),
  });
}
