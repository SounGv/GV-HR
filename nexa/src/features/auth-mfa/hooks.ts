"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { confirmMfa, disableMfa, fetchMfaStatus, setupMfa } from "./api";

export const mfaKeys = {
  status: ["auth-mfa", "status"] as const,
};

export function useMfaStatus() {
  return useQuery({ queryKey: mfaKeys.status, queryFn: () => fetchMfaStatus() });
}

export function useSetupMfa() {
  return useMutation({ mutationFn: () => setupMfa() });
}

export function useConfirmMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => confirmMfa(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: mfaKeys.status }),
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => disableMfa(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: mfaKeys.status }),
  });
}
