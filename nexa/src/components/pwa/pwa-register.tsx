"use client";

import { useEffect } from "react";

/**
 * Service-worker CLEANUP (not registration).
 *
 * The earlier PWA service worker cached Next.js chunks and, after redeploys,
 * served stale assets that crashed the app. We no longer register a SW; instead,
 * every load actively unregisters any existing SW and clears its caches, so
 * affected devices recover. (The kill-switch /sw.js handles devices whose page
 * JS never runs.) Reintroduce a correct SW later if offline support is needed.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);

  return null;
}
