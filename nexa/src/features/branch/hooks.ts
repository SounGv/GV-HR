"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBranches, createBranchApi, updateBranchApi, deleteBranchApi } from "./api";
import type { BranchCreateInput, BranchUpdateInput } from "./schema";

export const branchKeys = { all: ["branches"] as const };

export function useBranches() {
  return useQuery({ queryKey: branchKeys.all, queryFn: fetchBranches });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchCreateInput) => createBranchApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchUpdateInput }) => updateBranchApi(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBranchApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.all }),
  });
}
