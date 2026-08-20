"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployeeCompetencyGap,
  fetchPositionRequirements,
  setEmployeeCompetencyLevels,
  setPositionRequirements,
} from "./api";
import type { LevelItem } from "./types";

export const competencyMatrixKeys = {
  position: (positionId: string) => ["competency-matrix", "position", positionId] as const,
  employee: (employeeId: string) => ["competency-matrix", "employee", employeeId] as const,
};

export function usePositionRequirements(positionId: string) {
  return useQuery({
    queryKey: competencyMatrixKeys.position(positionId),
    queryFn: () => fetchPositionRequirements(positionId),
    enabled: !!positionId,
  });
}

export function useSetPositionRequirements(positionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: LevelItem[]) => setPositionRequirements(positionId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyMatrixKeys.position(positionId) }),
  });
}

export function useEmployeeCompetencyGap(employeeId: string) {
  return useQuery({
    queryKey: competencyMatrixKeys.employee(employeeId),
    queryFn: () => fetchEmployeeCompetencyGap(employeeId),
    enabled: !!employeeId,
  });
}

export function useSetEmployeeCompetencyLevels(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: LevelItem[]) => setEmployeeCompetencyLevels(employeeId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: competencyMatrixKeys.employee(employeeId) }),
  });
}
