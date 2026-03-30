// Unregister service worker and clear all caches
// This ensures users always get the latest version
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
  // Unregister self so future loads go straight to network
  self.registration.unregister();
});
