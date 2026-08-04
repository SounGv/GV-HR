"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSessions, revokeOtherSessions, revokeSession } from "./api";

export const sessionKeys = {
  all: ["auth-sessions"] as const,
};

export function useSessions() {
  return useQuery({ queryKey: sessionKeys.all, queryFn: () => fetchSessions() });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}
