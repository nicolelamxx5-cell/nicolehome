"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { processImage } from "@/lib/images";
import { getBrowserClient } from "@/lib/supabase/client";
import { registerImages } from "@/app/actions";
import { extFor } from "@/lib/images";

/** Add more screenshots, a warranty card or receipt photo to an existing option. */
export function PhotoAdder({ householdId, optionId }: { householdId: string; optionId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function upload(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const storage = getBrowserClient().storage.from("household-files");
      const rows = [];
      for (const f of Array.from(files)) {
        const img = await processImage(f);
        const base = `${householdId}/options/${optionId}/${crypto.randomUUID()}`;
        const path = `${base}.${extFor(img.type)}`;
        const up = await storage.upload(path, img.full, { contentType: img.type, upsert: true });
        if (up.error) throw new Error(up.error.message);
        let thumbPath: string | null = null;
        if (img.thumb) {
          thumbPath = `${base}-thumb.jpg`;
          if ((await storage.upload(thumbPath, img.thumb, { contentType: "image/jpeg", upsert: true })).error) thumbPath = null;
        }
        rows.push({ path, thumbPath, width: img.width ?? undefined, height: img.height ?? undefined });
      }
      const r = await registerImages(optionId, rows);
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div>
      <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
        <ImagePlus className="h-4 w-4" /> {busy ? "Uploading…" : "Add photos"}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && upload(e.target.files)} data-testid="photo-adder-input" />
      {error && <p role="alert" className="mt-1 text-sm text-rose">{error}</p>}
    </div>
  );
}
