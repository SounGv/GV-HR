import { api, type Envelope } from "@/lib/api/client";
import type { NotificationFeed } from "./types";
import type { SendNotificationInput } from "./schema";

export function fetchNotifications() {
  return api.get<Envelope<NotificationFeed>>("/api/notifications");
}

/** Omit `id` to mark every unread notification read; pass one to mark just that notification. */
export function markNotificationsRead(id?: string) {
  return api.post<Envelope<{ success: true }>>("/api/notifications/read", id ? { id } : {});
}

export function sendBroadcastNotification(input: SendNotificationInput) {
  return api.post<Envelope<{ sent: number }>>("/api/notifications/broadcast", input);
}
