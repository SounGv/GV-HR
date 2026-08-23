"use client";

import { useEffect } from "react";
import { useNotifications } from "@/features/notification/hooks";

/**
 * Badging API (navigator.setAppBadge) — puts the unread count on the
 * home-screen app icon, like LINE's red badge. This only reflects state
 * while the app is actually running (it rides the same 60s notification
 * poll as the topbar bell): there is no push-notification pipeline behind
 * it, so the badge won't update while the app is fully closed. A true
 * background badge would need real Web Push (VAPID + subscriptions +
 * a service worker push handler) — a much bigger feature, out of scope here.
 */
export function AppBadgeSync() {
  const { data } = useNotifications();
  const unread = data?.data?.unread ?? 0;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    if (unread > 0) {
      navigator.setAppBadge(unread).catch(() => {});
    } else {
      navigator.clearAppBadge?.().catch(() => {});
    }
  }, [unread]);

  return null;
}
