"use client";

import { useEffect } from "react";

/** Registers the service worker once, after the page is interactive. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // When a new SW activates and claims this page, reload once so we run
    // against fresh assets (self-heals installs stuck on stale v1 caches).
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    const register = () => {
      // updateViaCache: "none" → the browser always revalidates sw.js itself,
      // so a fixed SW is picked up promptly instead of from HTTP cache.
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        /* registration failures are non-fatal — the app still works online */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
