/* Doña Papa — service worker
   Guarda las apps en el teléfono para que abran sin internet.
   IMPORTANTE: sube el número de CACHE cada vez que cambies
   cualquier archivo, o los teléfonos siguen mostrando lo viejo. */
const CACHE = "donapapa-v3";
const ARCHIVOS = [
  "./",
  "./index.html",
  "./cocina.html",
  "./dueno.html",
  "./config.js",
  "./sync.js",
  "./manifest.json",
  "./manifest-cocina.json",
  "./manifest-dueno.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Primero la red (para recibir actualizaciones), y si no hay, lo guardado. */
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(()=>{});
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
