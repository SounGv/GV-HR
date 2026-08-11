"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelMeeting, createMeeting, fetchMeeting, fetchMeetings, respondToMeeting } from "./api";
import type { MeetingFormValues, MeetingScope } from "./types";

export const meetingKeys = {
  all: ["meetings"] as const,
  list: (scope: MeetingScope) => ["meetings", "list", scope] as const,
  detail: (id: string) => ["meetings", "detail", id] as const,
};

export function useMeetings(scope: MeetingScope) {
  return useQuery({
    queryKey: meetingKeys.list(scope),
    queryFn: () => fetchMeetings(scope),
    placeholderData: (prev) => prev,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => fetchMeeting(id),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingFormValues) => createMeeting(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: meetingKeys.all }),
  });
}

export function useCancelMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelMeeting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: meetingKeys.all }),
  });
}

export function useRespondToMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; action: "accept" | "decline"; note?: string }) =>
      respondToMeeting(v.id, v.action, v.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: meetingKeys.all }),
  });
}
