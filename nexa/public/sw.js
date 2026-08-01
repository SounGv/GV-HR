/* NEXA PWA service worker — v2 (safe).
 *
 * Lesson from v1: caching Next.js JS chunks / HTML made the SW serve stale
 * assets after a redeploy, which mismatched the fresh HTML and threw a
 * client-side ChunkLoadError. This version NEVER caches or serves app code:
 *  - It only precaches the /offline fallback page.
 *  - It intercepts *navigations only*, network-first, falling back to /offline
 *    when the network is unreachable. Everything else (JS, CSS, API, images)
 *    goes straight to the network untouched — so no stale-asset crashes.
 *  - On activate it deletes every older cache (incl. the bad v1 caches), so
 *    existing installs self-heal on their next visit.
 */
const CACHE = "nexa-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE_URL, "/nexa-logo.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle top-level page navigations; never touch JS/CSS/API/images.
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
