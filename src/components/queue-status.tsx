"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload } from "lucide-react";
import { listDrafts, syncDrafts, type Draft } from "@/lib/offline/queue";

/** Shows captures waiting on this phone and sends them when the connection returns. */
export function QueueStatus() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const refresh = useCallback(() => listDrafts().then(setDrafts).catch(() => setDrafts([])), []);
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setBusy(true);
    const r = await syncDrafts().catch(() => ({ sent: 0, failed: 1 }));
    setBusy(false);
    await refresh();
    if (r.sent) router.refresh();
  }, [refresh, router]);

  useEffect(() => {
    refresh().then(() => sync());
    const onOnline = () => sync();
    const onQueue = () => refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("homehub:queue", onQueue);
    const t = setInterval(() => navigator.onLine && sync(), 60_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("homehub:queue", onQueue);
      clearInterval(t);
    };
  }, [refresh, sync]);

  if (drafts.length === 0) return null;
  const err = drafts.find((d) => d.lastError && d.lastError !== "Offline")?.lastError;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b hairline bg-paper px-4 py-2 text-[13px]" role="status" data-testid="queue-status">
      <CloudUpload className="h-4 w-4 text-champagne-deep" />
      {drafts.length} capture{drafts.length === 1 ? "" : "s"} waiting to upload
      {err && <span className="text-rose">· last error: {err}</span>}
      <button className="underline underline-offset-4" onClick={sync} disabled={busy}>
        {busy ? "Sending…" : "Send now"}
      </button>
    </div>
  );
}
