"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Link2, X, Check, Plus, Search } from "lucide-react";
import { processImage, type ProcessedImage } from "@/lib/images";
import { saveDraft, syncDrafts, type Draft } from "@/lib/offline/queue";
import { CURRENCIES } from "@/lib/labels";
import { takeSharedFiles } from "@/lib/offline/share";

type Room = { id: string; name: string };
type Item = { id: string; name: string; room_id: string; legacy_id: string | null };
type Shot = { key: string; preview: string; processed: Promise<ProcessedImage> };

export function CaptureFlow(props: {
  householdId: string;
  rooms: Room[];
  items: Item[];
  initialRoomId?: string;
  initialItemId?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  fromShare?: boolean;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [shots, setShots] = useState<Shot[]>([]);
  const [url, setUrl] = useState(props.sharedUrl ?? "");
  const [title, setTitle] = useState(props.sharedTitle ?? "");
  const [titleHint, setTitleHint] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [roomId, setRoomId] = useState<string | undefined>(props.initialRoomId);
  const [itemId, setItemId] = useState<string | undefined>(props.initialItemId);
  const [newItemName, setNewItemName] = useState("");
  const [creatingItem, setCreatingItem] = useState(false);
  const [onePerPhoto, setOnePerPhoto] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Photos shared into the app from another app (Android share sheet).
  useEffect(() => {
    if (!props.fromShare) return;
    takeSharedFiles().then((files) => files.length && addFiles(files));
  }, [props.fromShare]);

  // Suggest a title from the page, where the site allows it. Never required.
  useEffect(() => {
    if (!/^https?:\/\//i.test(url) || title || !navigator.onLine) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
        if (r.ok) {
          const j = (await r.json()) as { title?: string };
          if (j.title) setTitleHint(j.title);
        }
      } catch {
        /* the site blocked us or we're offline — manual entry still works */
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [url, title]);

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    setShots((s) => [
      ...s,
      ...list.map((f) => ({ key: crypto.randomUUID(), preview: URL.createObjectURL(f), processed: processImage(f) })),
    ]);
  }

  const roomItems = useMemo(() => props.items.filter((i) => i.room_id === roomId), [props.items, roomId]);
  const visibleItems = query ? roomItems.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())) : roomItems;
  const chosenItem = props.items.find((i) => i.id === itemId);
  const hasContent = shots.length > 0 || /^https?:\/\//i.test(url.trim());
  const ready = hasContent && roomId && (itemId || (creatingItem && newItemName.trim()));
  const optionCount = shots.length > 1 && onePerPhoto ? shots.length : 1;

  async function save() {
    if (!ready || !roomId) return;
    setSaving(true);
    setError(null);
    try {
      const processed = await Promise.all(shots.map((s) => s.processed));
      const finalItemId = itemId ?? crypto.randomUUID();
      const p = price.trim() === "" ? null : Number(price);
      if (p !== null && (!Number.isFinite(p) || p < 0)) throw new Error("Price must be a number");
      const base = { title: title.trim() || undefined, url: url.trim() || undefined, price: p, currency: p !== null ? currency || null : null };
      const options =
        optionCount > 1
          ? processed.map((img, i) => ({ ...base, id: crypto.randomUUID(), title: base.title ? `${base.title} (${i + 1})` : undefined, images: [img] }))
          : [{ ...base, id: crypto.randomUUID(), images: processed }];
      const draft: Draft = {
        key: crypto.randomUUID(),
        householdId: props.householdId,
        itemId: finalItemId,
        newItem: itemId ? undefined : { roomId, name: newItemName.trim() },
        options,
        createdAt: Date.now(),
        attempts: 0,
        label: `${options.length} option${options.length === 1 ? "" : "s"} for ${chosenItem?.name ?? newItemName.trim()}`,
      };
      await saveDraft(draft);
      if (!navigator.onLine) {
        setSavedOffline(draft.label);
        reset();
        return;
      }
      const r = await syncDrafts();
      if (r.failed > 0) {
        setSavedOffline(draft.label);
        reset();
        return;
      }
      router.push(options.length === 1 ? `/options/${options[0].id}?new=1` : `/items/${finalItemId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  }

  function reset() {
    setShots([]);
    setUrl("");
    setTitle("");
    setPrice("");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <div className="eyebrow">Add product</div>
        <h1 className="font-display text-4xl">What did you find?</h1>
      </div>

      {savedOffline && (
        <div role="status" className="mb-5 rounded-2xl border border-sage/30 bg-sage/5 px-4 py-3 text-[14px]" data-testid="saved-offline">
          Saved on this phone: {savedOffline}. It will upload automatically when you are back online.
          <button className="ml-2 underline" onClick={() => setSavedOffline(null)}>Add another</button>
        </div>
      )}

      {/* 1. Screenshots / photos / link */}
      <section className="card p-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" onClick={() => libraryRef.current?.click()}>
            <ImagePlus className="h-5 w-5" /> Screenshots
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-5 w-5" /> Take photo
          </button>
        </div>
        <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} data-testid="file-input" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

        {shots.length > 0 && (
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {shots.map((s) => (
              <div key={s.key} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="Selected" className="h-24 w-20 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-ivory"
                  onClick={() => setShots((x) => x.filter((y) => y.key !== s.key))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {shots.length > 1 && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]" role="radiogroup" aria-label="How to save these photos">
            <button type="button" role="radio" aria-checked={onePerPhoto} onClick={() => setOnePerPhoto(true)} className={`btn btn-sm ${onePerPhoto ? "btn-primary" : "btn-quiet"}`}>
              {shots.length} different products
            </button>
            <button type="button" role="radio" aria-checked={!onePerPhoto} onClick={() => setOnePerPhoto(false)} className={`btn btn-sm ${!onePerPhoto ? "btn-primary" : "btn-quiet"}`}>
              One product, {shots.length} photos
            </button>
          </div>
        )}

        <div className="relative mt-4">
          <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
          <input
            className="field pl-11"
            type="url"
            inputMode="url"
            placeholder="Or paste a link (Taobao, 1688, any shop)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Product link"
          />
        </div>
      </section>

      {/* 2. Room */}
      <section className="mt-6">
        <h2 className="mb-3 text-[15px] font-medium">Which room?</h2>
        <div className="flex flex-wrap gap-2">
          {props.rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRoomId(r.id);
                if (chosenItem?.room_id !== r.id) setItemId(undefined);
              }}
              aria-pressed={roomId === r.id}
              className={`btn btn-sm ${roomId === r.id ? "btn-primary" : "btn-quiet"}`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Item */}
      {roomId && (
        <section className="mt-6">
          <h2 className="mb-3 text-[15px] font-medium">Which item is it for?</h2>
          {roomItems.length > 8 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
              <input className="field pl-11" placeholder="Filter items" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter items" />
            </div>
          )}
          <div className="card max-h-80 divide-y hairline overflow-y-auto">
            {visibleItems.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  setItemId(i.id);
                  setCreatingItem(false);
                }}
                aria-pressed={itemId === i.id}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] ${itemId === i.id ? "bg-linen" : ""}`}
              >
                <span className="flex-1">{i.name}</span>
                {itemId === i.id && <Check className="h-4 w-4 text-champagne-deep" />}
              </button>
            ))}
            {visibleItems.length === 0 && <p className="px-4 py-3 text-[14px] text-muted">No items yet in this room.</p>}
          </div>
          {!creatingItem ? (
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => { setCreatingItem(true); setItemId(undefined); }}>
              <Plus className="h-4 w-4" /> New item
            </button>
          ) : (
            <input className="field mt-2" autoFocus placeholder="Name the new item, e.g. Dining pendant light" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} aria-label="New item name" />
          )}
        </section>
      )}

      {/* 4. Optional details */}
      <section className="mt-6">
        {!showMore ? (
          <button type="button" className="text-[14px] text-muted underline underline-offset-4" onClick={() => setShowMore(true)}>
            Add a name or price now (optional)
          </button>
        ) : (
          <div className="card space-y-3 p-4">
            <div>
              <label className="label" htmlFor="cap-title">Product name</label>
              <input id="cap-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
              {titleHint && !title && (
                <button type="button" className="mt-1 text-left text-[12px] text-muted" onClick={() => setTitle(titleHint.slice(0, 300))}>
                  From the page: “{titleHint.slice(0, 90)}” — <span className="underline">use this</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div>
                <label className="label" htmlFor="cap-price">Price you saw</label>
                <input id="cap-price" className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 1462" />
              </div>
              <div>
                <label className="label" htmlFor="cap-currency">Currency</label>
                <select id="cap-currency" className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="">Not sure</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[12px] text-muted">Saved as “seen online — not a quote” until you confirm it.</p>
          </div>
        )}
      </section>

      {error && <p role="alert" className="mt-4 text-sm text-rose">{error}</p>}

      <div className="sticky bottom-24 mt-8 md:bottom-6">
        <button type="button" className="btn btn-primary w-full shadow-lg" disabled={!ready || saving} onClick={save} data-testid="save-capture">
          {saving ? "Saving…" : ready ? `Save ${optionCount > 1 ? `${optionCount} options` : "option"}` : hasContent ? "Choose a room and item" : "Add a screenshot or link"}
        </button>
        {props.aiEnabled && <p className="mt-2 text-center text-[12px] text-muted">After saving, you can ask the app to read details from the screenshot.</p>}
      </div>
    </div>
  );
}
