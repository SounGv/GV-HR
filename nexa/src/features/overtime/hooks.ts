"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelOvertime,
  createOvertime,
  decideOvertime,
  fetchOvertime,
} from "./api";
import type { OtFormValues, OtScope, OtStatus } from "./types";

export const overtimeKeys = {
  all: ["overtime"] as const,
  list: (scope: OtScope, status?: OtStatus) => ["overtime", "list", scope, status] as const,
};

export function useOvertime(scope: OtScope, status?: OtStatus) {
  return useQuery({
    queryKey: overtimeKeys.list(scope, status),
    queryFn: () => fetchOvertime(scope, status),
    placeholderData: (prev) => prev,
  });
}

export function useCreateOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OtFormValues) => createOvertime(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: overtimeKeys.all }),
  });
}

export function useDecideOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideOvertime(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: overtimeKeys.all }),
  });
}

export function useCancelOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelOvertime(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: overtimeKeys.all }),
  });
}
