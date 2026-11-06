"use client";
// The service worker stores files shared from other apps (Android share sheet)
// in Cache Storage; the Add screen picks them up here.
const CACHE = "homehub-share";

export async function takeSharedFiles(): Promise<File[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const files: File[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (!res) continue;
    const blob = await res.blob();
    const name = decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "shared.jpg");
    files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
    await cache.delete(req);
  }
  return files;
}
