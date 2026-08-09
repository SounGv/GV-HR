"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyProfile, generateLineLinkCode, unlinkLine, updateMyProfileApi } from "./api";
import type { SelfProfileInput } from "./schema";

export const profileKeys = {
  me: ["profile", "me"] as const,
};

export function useMyProfile() {
  return useQuery({ queryKey: profileKeys.me, queryFn: fetchMyProfile });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SelfProfileInput) => updateMyProfileApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.me }),
  });
}

export function useGenerateLineLinkCode() {
  return useMutation({ mutationFn: generateLineLinkCode });
}

export function useUnlinkLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlinkLine,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.me }),
  });
}
