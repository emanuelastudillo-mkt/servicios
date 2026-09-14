const CACHE_NAME = "pulso-global-v6.4.0";
const ASSETS = ["./", "./index.html", "./styles.css", "./styles-v6.css", "./countries-extra.js", "./data.js", "./country-facts.js", "./catalog-v6.js", "./simulation-v6.js", "./engine.js", "./ui-v6.js", "./app.js", "./world.geojson", "./manifest.webmanifest", "./README.md", "./FUENTES.md", "./VERSION.txt", "./assets/icons-manifest.json", "./assets/ATTRIBUTION.md"];

async function assetList() {
  const response = await fetch("./assets/icons-manifest.json", { cache: "reload" });
  if (!response.ok) throw new Error("No se pudo cargar el manifiesto de iconos");
  const manifest = await response.json();
  return [...Object.values(manifest.flags), ...Object.values(manifest.resources)].map((item) => `./${item.file}`);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const [cache, icons] = await Promise.all([caches.open(CACHE_NAME), assetList()]);
    await cache.addAll([...ASSETS, ...icons].map(url => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("pulso-global-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    // Never search all caches: an old tab may recreate its previous-version
    // cache while an update activates. Only this release is a valid source.
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && new URL(event.request.url).origin === self.location.origin)
      await cache.put(event.request, response.clone());
    return response;
  })());
});
