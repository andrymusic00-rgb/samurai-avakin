/* Service worker — Samurai di Avakin
 *
 * Strategia:
 *  - navigazioni: network first, cache come ripiego (il sito resta apribile offline)
 *  - asset statici (css/js/icona): stale-while-revalidate
 *  - richieste API: mai in cache, per non mostrare dati di sessione stantii
 */

const VERSION = "samurai-v2";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/assets/css/core.css",
  "/assets/css/layout.css",
  "/assets/css/components.css",
  "/assets/css/features.css",
  "/assets/js/data.js",
  "/assets/js/art.js",
  "/assets/js/fx.js",
  "/assets/js/api.js",
  "/assets/js/ui.js",
  "/assets/js/account.js",
  "/assets/js/views.js",
  "/assets/js/main.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isStatic(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nessuna cache per le API: dati e sessioni devono restare sempre freschi.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/", copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match("/offline.html")))
    );
    return;
  }

  if (isStatic(url)) {
    // In sviluppo la cache maschera le modifiche: su localhost si va sempre
    // in rete, cosi' un reload mostra davvero il file appena scritto.
    if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
