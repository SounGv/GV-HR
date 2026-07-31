"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  fetchPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from "./api";
import type { DepartmentFormValues, PositionFormValues } from "./types";

export const orgKeys = {
  all: ["organization"] as const,
  departments: ["organization", "departments"] as const,
  positions: ["organization", "positions"] as const,
};

export function useDepartments() {
  return useQuery({ queryKey: orgKeys.departments, queryFn: fetchDepartments });
}
export function usePositions() {
  return useQuery({ queryKey: orgKeys.positions, queryFn: fetchPositions });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orgKeys.all });
}

export function useCreateDepartment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: DepartmentFormValues) => createDepartment(i), onSuccess: invalidate });
}
export function useUpdateDepartment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<DepartmentFormValues> }) => updateDepartment(v.id, v.input),
    onSuccess: invalidate,
  });
}
export function useDeleteDepartment() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteDepartment(id), onSuccess: invalidate });
}

export function useCreatePosition() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: PositionFormValues) => createPosition(i), onSuccess: invalidate });
}
export function useUpdatePosition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<PositionFormValues> }) => updatePosition(v.id, v.input),
    onSuccess: invalidate,
  });
}
export function useDeletePosition() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deletePosition(id), onSuccess: invalidate });
}
