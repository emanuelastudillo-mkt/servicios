// Scope is tutorial/ only. Never intercept API calls or the online game.
const CACHE = "apex1000-training-1.6.2";
const FILES = [
  "./",
  "./index.html",
  "./style.css?v=1.6.2",
  "./app.js?v=1.6.2",
  "./engine.js?v=1.6.2",
  "./viewer.js?v=1.6.2",
  "./viewer-model.js?v=1.6.2",
  "../favicon.svg",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(new URL("./", self.location.href).pathname)
  )
    return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (
        (await cache.match(event.request)) ||
        (event.request.mode === "navigate"
          ? await cache.match("./index.html")
          : undefined) ||
        new Response("Archivo offline no disponible", { status: 503 })
      );
    }),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_OFFLINE")
    event.source?.postMessage({ type: "OFFLINE_READY" });
});
