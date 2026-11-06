"use client";
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SW_IN_DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    // After sign-out, forget cached private pages and photos on this device.
    if (new URLSearchParams(location.search).has("signedout")) {
      navigator.serviceWorker.ready.then((r) => r.active?.postMessage("clear-private"));
      try {
        indexedDB.deleteDatabase("homehub-offline");
      } catch {
        /* ignore */
      }
    }
  }, []);
  return null;
}
