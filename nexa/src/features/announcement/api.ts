import { api, type Envelope } from "@/lib/api/client";
import type { Announcement, AnnouncementFormValues, AnnouncementScope } from "./types";

export function fetchAnnouncements(scope: AnnouncementScope) {
  return api.get<Envelope<Announcement[]>>(`/api/announcements?scope=${scope}`);
}

export function createAnnouncement(input: AnnouncementFormValues) {
  return api.post<Envelope<Announcement>>("/api/announcements", input);
}

export function updateAnnouncement(id: string, input: Partial<AnnouncementFormValues>) {
  return api.patch<Envelope<Announcement>>(`/api/announcements/${id}`, input);
}

export function deleteAnnouncement(id: string) {
  return api.del<Envelope<{ ok: true }>>(`/api/announcements/${id}`);
}
