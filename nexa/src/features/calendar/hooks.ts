"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDay, fetchMonth, fetchMonthCounts, createEvent, updateEvent, deleteEvent } from "./api";
import type { EventFormValues } from "./types";

export const calendarKeys = {
  all: ["calendar"] as const,
  month: (month: string) => ["calendar", "month", month] as const,
};

export function useMonth(month: string) {
  return useQuery({
    queryKey: calendarKeys.month(month),
    queryFn: () => fetchMonth(month),
    placeholderData: (prev) => prev,
  });
}

/** Absent / leave / late head-counts for each day of a month, drawn inside the calendar cells. */
export function useMonthCounts(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ["calendar", "counts", month] as const,
    queryFn: () => fetchMonthCounts(month),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

/** Whole-company attendance for one day; only asked for by people who may see attendance. */
export function useDayAttendance(date: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["calendar", "day", date] as const,
    queryFn: () => fetchDay(date!),
    enabled: enabled && !!date,
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: calendarKeys.all });
}

export function useCreateEvent() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (i: EventFormValues) => createEvent(i), onSuccess: invalidate });
}

export function useUpdateEvent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<EventFormValues> }) => updateEvent(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteEvent(id), onSuccess: invalidate });
}
