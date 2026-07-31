import { api, type Envelope } from "@/lib/api/client";
import type { NotificationFeed } from "./types";

export function fetchNotifications() {
  return api.get<Envelope<NotificationFeed>>("/api/notifications");
}

export function markNotificationsRead() {
  return api.post<Envelope<{ success: true }>>("/api/notifications/read", {});
}
