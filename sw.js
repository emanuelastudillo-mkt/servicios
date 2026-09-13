const CACHE_NAME = "pulso-global-v5.4.0";
const ASSETS = ["./", "./index.html", "./styles.css", "./countries-extra.js", "./data.js", "./engine.js", "./app.js", "./world.geojson", "./manifest.webmanifest", "./README.md", "./FUENTES.md", "./VERSION.txt", "./assets/icons-manifest.json", "./assets/ATTRIBUTION.md"];

async function assetList() {
  const response = await fetch("./assets/icons-manifest.json");
  if (!response.ok) throw new Error("No se pudo cargar el manifiesto de iconos");
  const manifest = await response.json();
  return [...Object.values(manifest.flags), ...Object.values(manifest.resources)].map((item) => `./${item.file}`);
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([caches.open(CACHE_NAME), assetList()]).then(([cache, icons]) => cache.addAll([...ASSETS, ...icons])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("pulso-global-") && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
