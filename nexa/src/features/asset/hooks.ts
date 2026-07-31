"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignAsset,
  createAsset,
  deleteAsset,
  fetchAssets,
  updateAsset,
} from "./api";
import type { AssetFormValues, AssetStatus } from "./types";

export const assetKeys = {
  all: ["assets"] as const,
  list: (status?: AssetStatus, search?: string) => ["assets", "list", status, search] as const,
};

export function useAssets(status?: AssetStatus, search?: string) {
  return useQuery({
    queryKey: assetKeys.list(status, search),
    queryFn: () => fetchAssets(status, search),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssetFormValues) => createAsset(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

export function useUpdateAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AssetFormValues>) => updateAsset(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.all }),
  });
}

export function useAssignAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; employeeId: string | null }) => assignAsset(v.id, v.employeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetKeys.all }),
  });
}
