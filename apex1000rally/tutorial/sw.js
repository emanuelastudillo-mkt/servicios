// Scope is tutorial/ only. Never intercept API calls or the online game.
const CACHE = "apex1000-training-1.6.4";
const RELEASE = "1.6.4";
const FILES = [
  "./",
  "./index.html",
  "./style.css?v=1.6.4",
  "./app.js?v=1.6.4",
  "./engine.js?v=1.6.4",
  "./viewer.js?v=1.6.4",
  "./viewer-model.js?v=1.6.4",
  "../favicon.svg",
  "./assets/tutorial-terrain-v1.png",
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
    (!url.pathname.startsWith(new URL("./", self.location.href).pathname) &&
      url.href !== new URL("../favicon.svg", self.location.href).href)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      // Versioned local assets need no repeated network request. Navigation checks updates.
      if (event.request.mode !== "navigate" && cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          if (
            event.request.mode !== "navigate" &&
            FILES.some(
              (file) => new URL(file, self.location.href).href === url.href,
            )
          )
            await cache.put(event.request, response.clone()).catch(() => {});
          return response;
        }
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (await cache.match("./index.html")) || response;
        return response;
      } catch {
        return (
          cached ||
          (event.request.mode === "navigate"
            ? await cache.match("./index.html")
            : await caches.match(event.request)) ||
          new Response("Archivo offline no disponible", { status: 503 })
        );
      }
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_OFFLINE")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const complete = (
          await Promise.all(FILES.map((file) => cache.match(file)))
        ).every((response) => response?.ok);
        if (complete)
          event.source?.postMessage({
            type: "OFFLINE_READY",
            version: RELEASE,
          });
      })(),
    );
});
