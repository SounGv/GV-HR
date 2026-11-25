import { api, type Envelope } from "@/lib/api/client";
import type { CalendarDayAttendance, CalendarMonth, EventFormValues } from "./types";

export function fetchDay(date: string) {
  return api.get<Envelope<CalendarDayAttendance>>(`/api/calendar/day?date=${date}`);
}

export function fetchMonth(month: string) {
  return api.get<Envelope<CalendarMonth>>(`/api/calendar?month=${month}`);
}

export function createEvent(input: EventFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/calendar", input);
}

export function updateEvent(id: string, input: Partial<EventFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/calendar/${id}`, input);
}

export function deleteEvent(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/calendar/${id}`);
}
