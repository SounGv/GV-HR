import { api, type Envelope } from "@/lib/api/client";
import type { ScheduleTemplateDetail, ScheduleTemplateFormValues, ScheduleTemplateListItem } from "./types";

export function fetchScheduleTemplates() {
  return api.get<Envelope<ScheduleTemplateListItem[]>>("/api/evaluation-schedules");
}

export function fetchScheduleTemplate(id: string) {
  return api.get<Envelope<ScheduleTemplateDetail>>(`/api/evaluation-schedules/${id}`);
}

export function createScheduleTemplate(input: ScheduleTemplateFormValues) {
  return api.post<Envelope<{ id: string }>>("/api/evaluation-schedules", input);
}

export function updateScheduleTemplate(id: string, input: Partial<ScheduleTemplateFormValues>) {
  return api.patch<Envelope<{ id: string }>>(`/api/evaluation-schedules/${id}`, input);
}

export function deleteScheduleTemplate(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/evaluation-schedules/${id}`);
}
