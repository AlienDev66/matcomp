/* TEAM FS Display — focused service worker (do NOT cache payment app indiscriminately). */
const CACHE = "teamfs-display-v1";
const PRECACHE = [
  "/display",
  "/display/",
  "/display/control",
  "/manifest-display.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("teamfs-display-") && k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  const isDisplayNav =
    url.pathname === "/display" ||
    url.pathname === "/display/" ||
    url.pathname.startsWith("/display/");

  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest");

  // Only intercept display routes + their assets (referrer/display path heuristic)
  const referrerDisplay =
    event.request.referrer &&
    (event.request.referrer.includes("/display") || event.request.referrer.includes("/display/"));

  if (!isDisplayNav && !(isAsset && (referrerDisplay || isDisplayNav))) {
    // Still cache display assets when requested from display pages
    if (!(isAsset && referrerDisplay)) return;
  }

  event.respondWith(
    (async () => {
      try {
        const network = await fetch(event.request);
        if (network.ok && (isDisplayNav || isAsset)) {
          const cache = await caches.open(CACHE);
          void cache.put(event.request, network.clone());
        }
        return network;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (isDisplayNav) {
          const fallback = await caches.match("/display/") || (await caches.match("/display"));
          if (fallback) return fallback;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })(),
  );
});
