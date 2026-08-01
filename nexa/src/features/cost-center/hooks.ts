"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCostCenters, createCostCenterApi, updateCostCenterApi, deleteCostCenterApi } from "./api";
import type { CostCenterCreateInput, CostCenterUpdateInput } from "./schema";

export const costCenterKeys = { all: ["cost-centers"] as const };

export function useCostCenters() {
  return useQuery({ queryKey: costCenterKeys.all, queryFn: fetchCostCenters });
}
export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CostCenterCreateInput) => createCostCenterApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: costCenterKeys.all }),
  });
}
export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CostCenterUpdateInput }) => updateCostCenterApi(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: costCenterKeys.all }),
  });
}
export function useDeleteCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCostCenterApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: costCenterKeys.all }),
  });
}
