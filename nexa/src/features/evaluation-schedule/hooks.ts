"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScheduleTemplate,
  deleteScheduleTemplate,
  fetchScheduleTemplate,
  fetchScheduleTemplates,
  updateScheduleTemplate,
} from "./api";
import type { ScheduleTemplateFormValues } from "./types";

export const scheduleTemplateKeys = {
  all: ["evaluation-schedules"] as const,
  detail: (id: string) => ["evaluation-schedules", "detail", id] as const,
};

export function useScheduleTemplates() {
  return useQuery({
    queryKey: scheduleTemplateKeys.all,
    queryFn: () => fetchScheduleTemplates(),
    placeholderData: (prev) => prev,
  });
}

export function useScheduleTemplate(id: string) {
  return useQuery({
    queryKey: scheduleTemplateKeys.detail(id),
    queryFn: () => fetchScheduleTemplate(id),
    enabled: !!id,
  });
}

export function useCreateScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleTemplateFormValues) => createScheduleTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleTemplateKeys.all }),
  });
}

export function useUpdateScheduleTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ScheduleTemplateFormValues>) => updateScheduleTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleTemplateKeys.all }),
  });
}

export function useDeleteScheduleTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScheduleTemplate(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: scheduleTemplateKeys.all });
      qc.removeQueries({ queryKey: scheduleTemplateKeys.detail(id) });
    },
  });
}
