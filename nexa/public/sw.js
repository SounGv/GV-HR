/* NEXA service worker — SELF-DESTRUCT / kill switch.
 *
 * A previous SW cached Next.js chunks and, after redeploys, served stale assets
 * that crashed the app ("client-side exception"). This SW exists only to undo
 * that: on activation it deletes every cache, unregisters itself, and reloads
 * any controlled tab so it runs against the network with a clean slate.
 *
 * This runs at the service-worker layer, independent of the page's JS, so it
 * heals devices even when the stale bundle would otherwise crash before any app
 * code executes. After it unregisters, no service worker controls the site.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        // Reload each open tab now that caches are gone and the SW is detaching.
        client.navigate(client.url);
      }
    })(),
  );
});

// While this SW is briefly active, never serve anything from cache.
self.addEventListener("fetch", () => {});
