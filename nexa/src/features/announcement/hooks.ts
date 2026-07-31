"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from "./api";
import type { AnnouncementFormValues, AnnouncementScope } from "./types";

export const announcementKeys = {
  all: ["announcements"] as const,
  list: (scope: AnnouncementScope) => ["announcements", "list", scope] as const,
};

export function useAnnouncements(scope: AnnouncementScope) {
  return useQuery({
    queryKey: announcementKeys.list(scope),
    queryFn: () => fetchAnnouncements(scope),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementFormValues) => createAnnouncement(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useUpdateAnnouncement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AnnouncementFormValues>) => updateAnnouncement(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}
