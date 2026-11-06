"use client";
// Offline capture queue. Every capture is written to IndexedDB first, then
// sent. Each draft carries client-generated ids, so a retry after a dropped
// connection updates the same records instead of creating duplicates.

import { getBrowserClient } from "@/lib/supabase/client";
import { createItem, createOptions, registerImages } from "@/app/actions";
import { extFor, type ProcessedImage } from "@/lib/images";

export interface DraftOption {
  id: string; // product_options.id
  title?: string;
  url?: string;
  price?: number | null;
  currency?: string | null;
  notes?: string;
  images: ProcessedImage[];
}

export interface Draft {
  key: string;
  householdId: string;
  itemId: string;
  newItem?: { roomId: string; name: string };
  options: DraftOption[];
  createdAt: number;
  attempts: number;
  lastError?: string;
  label: string;
}

const DB = "homehub-offline";
const STORE = "drafts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveDraft = (d: Draft) => tx("readwrite", (s) => s.put(d));
export const deleteDraft = (key: string) => tx("readwrite", (s) => s.delete(key));
export const listDrafts = () => tx<Draft[]>("readonly", (s) => s.getAll() as IDBRequest<Draft[]>);

let syncing: Promise<{ sent: number; failed: number }> | null = null;

/** Send every queued draft. Safe to call repeatedly; runs one sync at a time. */
export function syncDrafts(): Promise<{ sent: number; failed: number }> {
  if (syncing) return syncing;
  syncing = (async () => {
    let sent = 0;
    let failed = 0;
    for (const d of await listDrafts()) {
      try {
        await sendDraft(d);
        await deleteDraft(d.key);
        sent++;
      } catch (e) {
        failed++;
        await saveDraft({ ...d, attempts: d.attempts + 1, lastError: e instanceof Error ? e.message : String(e) });
      }
    }
    window.dispatchEvent(new CustomEvent("homehub:queue"));
    return { sent, failed };
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function sendDraft(d: Draft) {
  if (!navigator.onLine) throw new Error("Offline");
  if (d.newItem) {
    const fd = new FormData();
    fd.set("id", d.itemId);
    fd.set("roomId", d.newItem.roomId);
    fd.set("name", d.newItem.name);
    const r = await createItem(fd);
    if (!r.ok) throw new Error(r.error);
  }
  const created = await createOptions({
    itemId: d.itemId,
    options: d.options.map((o) => ({ id: o.id, title: o.title, url: o.url, price: o.price, currency: o.currency, notes: o.notes })),
  });
  if (!created.ok) throw new Error(created.error);

  const storage = getBrowserClient().storage.from("household-files");
  for (const o of d.options) {
    const rows: { path: string; thumbPath: string | null; width?: number; height?: number }[] = [];
    for (let i = 0; i < o.images.length; i++) {
      const img = o.images[i];
      // Deterministic names: re-sending overwrites rather than duplicates.
      const base = `${d.householdId}/options/${o.id}/${d.key}-${i}`;
      const path = `${base}.${extFor(img.type)}`;
      const up = await storage.upload(path, img.full, { contentType: img.type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      let thumbPath: string | null = null;
      if (img.thumb) {
        thumbPath = `${base}-thumb.jpg`;
        const t = await storage.upload(thumbPath, img.thumb, { contentType: "image/jpeg", upsert: true });
        if (t.error) thumbPath = null;
      }
      rows.push({ path, thumbPath, width: img.width ?? undefined, height: img.height ?? undefined });
    }
    if (rows.length) {
      const r = await registerImages(o.id, rows);
      if (!r.ok) throw new Error(r.error);
    }
  }
}
