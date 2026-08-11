import { api, type Envelope } from "@/lib/api/client";
import type { Meeting, MeetingFormValues, MeetingListItem, MeetingScope } from "./types";

export function fetchMeetings(scope: MeetingScope) {
  const params = new URLSearchParams({ scope });
  return api.get<Envelope<MeetingListItem[]>>(`/api/meetings?${params.toString()}`);
}

export function fetchMeeting(id: string) {
  return api.get<Envelope<Meeting>>(`/api/meetings/${id}`);
}

export function createMeeting(input: MeetingFormValues) {
  return api.post<Envelope<Meeting>>("/api/meetings", input);
}

export function cancelMeeting(id: string) {
  return api.post<Envelope<Meeting>>(`/api/meetings/${id}/cancel`);
}

export function respondToMeeting(id: string, action: "accept" | "decline", note?: string) {
  return api.post<Envelope<Meeting>>(`/api/meetings/${id}/respond`, { action, note });
}
