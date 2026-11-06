/* 661C Home Hub service worker.
 * - Pages: network first; if the network fails, show the last copy saved on this phone.
 * - App code (/_next/static): cache first (files are content-hashed).
 * - Product photos (private signed URLs): cached on this phone after first view, keyed
 *   without the expiring token, so they show offline. Never shared or public.
 * - Share target: photos/links shared from other apps (Android) are stashed and opened in Add.
 * Captures made offline are queued in IndexedDB by the app itself, not here.
 */
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const PHOTOS = `photos-${VERSION}`;
const SHARE = "homehub-share";
const OFFLINE_URL = "/offline";
const MAX_PHOTOS = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES, PHOTOS, SHARE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent after sign-out: forget this household's pages and photos on this device.
  if (event.data === "clear-private") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(PHOTOS), caches.delete(SHARE)]));
  }
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function trimPhotos() {
  const cache = await caches.open(PHOTOS);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}

async function handleShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE);
  const files = form.getAll("files");
  let n = 0;
  for (const f of files) {
    if (typeof f === "string") continue;
    await cache.put(`/shared/${Date.now()}-${n++}-${encodeURIComponent(f.name || "photo.jpg")}`, new Response(f, { headers: { "Content-Type": f.type || "image/jpeg" } }));
  }
  const params = new URLSearchParams({ shared: "1" });
  for (const k of ["title", "text", "url"]) {
    const v = form.get(k);
    if (typeof v === "string" && v) params.set(k, v);
  }
  return Response.redirect(`/add?${params.toString()}`, 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") {
    event.respondWith(handleShare(req));
    return;
  }
  if (req.method !== "GET") return;

  // Private product photos from Supabase Storage (signed URLs)
  if (url.origin !== self.location.origin) {
    if (url.pathname.includes("/storage/v1/object/sign/")) {
      const key = url.origin + url.pathname; // drop the expiring token
      event.respondWith(
        caches.open(PHOTOS).then(async (cache) => {
          const hit = await cache.match(key);
          if (hit) return hit;
          // <img> requests are no-cors (opaque); fetch with CORS so the photo can be cached.
          const res = await fetch(req.url, { mode: "cors", credentials: "omit" }).catch(() => fetch(req));
          if (res.ok) {
            await cache.put(key, res.clone());
            trimPhotos();
          }
          return res;
        }),
      );
    }
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  const isRsc = req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isRsc) {
    // Let client-side navigations fail fast offline; Next then does a full page load,
    // which the navigation handler below can answer from the page cache.
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await Promise.race([fetch(req), timeout(10000)]);
          const finalPath = new URL(res.url || req.url).pathname;
          if (res.ok && !res.redirected && finalPath !== "/login" && !finalPath.startsWith("/setup")) {
            cache.put(url.pathname + url.search, res.clone());
            if (url.search) cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const hit = (await cache.match(url.pathname + url.search)) || (await cache.match(url.pathname));
          if (hit) return hit;
          if (url.pathname === "/add") {
            const add = await cache.match("/add");
            if (add) return add;
          }
          return (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 });
        }
      })(),
    );
  }
});
