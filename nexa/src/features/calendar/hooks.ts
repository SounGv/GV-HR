"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMonth, createEvent, updateEvent, deleteEvent } from "./api";
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
