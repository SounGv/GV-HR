"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clockIn, clockOut, fetchAttendance, fetchToday } from "./api";
import type { AttendanceScope, ClockPayload } from "./types";

export const attendanceKeys = {
  all: ["attendance"] as const,
  today: ["attendance", "today"] as const,
  list: (scope: AttendanceScope) => ["attendance", "list", scope] as const,
};

export function useToday() {
  return useQuery({ queryKey: attendanceKeys.today, queryFn: fetchToday });
}

export function useAttendance(scope: AttendanceScope) {
  return useQuery({
    queryKey: attendanceKeys.list(scope),
    queryFn: () => fetchAttendance(scope),
    placeholderData: (prev) => prev,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClockPayload) => clockIn(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClockPayload) => clockOut(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.all }),
  });
}
