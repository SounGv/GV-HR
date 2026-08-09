"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelAttendanceCorrection,
  createAttendanceCorrection,
  decideAttendanceCorrection,
  fetchAttendanceCorrections,
} from "./api";
import type { AttendanceCorrectionFormValues, AttendanceCorrectionScope, AttendanceCorrectionStatus } from "./types";

export const attendanceCorrectionKeys = {
  all: ["attendance-corrections"] as const,
  list: (scope: AttendanceCorrectionScope, status?: AttendanceCorrectionStatus) =>
    ["attendance-corrections", "list", scope, status] as const,
};

export function useAttendanceCorrections(scope: AttendanceCorrectionScope, status?: AttendanceCorrectionStatus) {
  return useQuery({
    queryKey: attendanceCorrectionKeys.list(scope, status),
    queryFn: () => fetchAttendanceCorrections(scope, status),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttendanceCorrectionFormValues) => createAttendanceCorrection(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceCorrectionKeys.all }),
  });
}

export function useDecideAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      decideAttendanceCorrection(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceCorrectionKeys.all }),
  });
}

export function useCancelAttendanceCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAttendanceCorrection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceCorrectionKeys.all }),
  });
}
