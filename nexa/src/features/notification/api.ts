import { api, type Envelope } from "@/lib/api/client";
import type { NotificationFeed } from "./types";
import type { SendNotificationInput } from "./schema";

export function fetchNotifications() {
  return api.get<Envelope<NotificationFeed>>("/api/notifications");
}

export function markNotificationsRead() {
  return api.post<Envelope<{ success: true }>>("/api/notifications/read", {});
}

export function sendBroadcastNotification(input: SendNotificationInput) {
  return api.post<Envelope<{ sent: number }>>("/api/notifications/broadcast", input);
}
