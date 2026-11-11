"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDepartments,
  fetchOrgPeople,
  saveOrgMoves,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  fetchPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from "./api";
import type { DepartmentFormValues, PositionFormValues } from "./types";
import type { OrgMove } from "./org-tree";

export const orgKeys = {
  all: ["organization"] as const,
  departments: ["organization", "departments"] as const,
  positions: ["organization", "positions"] as const,
  people: ["organization", "people"] as const,
};

export function useDepartments() {
  return useQuery({ queryKey: orgKeys.departments, queryFn: fetchDepartments });
}
/** Active employees with department and manager, for the org chart's people view. */
export function useOrgPeople() {
  return useQuery({ queryKey: orgKeys.people, queryFn: fetchOrgPeople });
}
export function usePositions() {
  return useQuery({ queryKey: orgKeys.positions, queryFn: fetchPositions });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orgKeys.all });
}

/**
 * Saves the org chart's pending moves. Resolves only after the org and
 * employee queries have refetched, so the chart never flashes the old layout.
 */
export function useSaveOrgMoves() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moves: OrgMove[]) => saveOrgMoves(moves),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: orgKeys.all }),
        qc.invalidateQueries({ queryKey: ["employees"] }),
      ]),
  });
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
