"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { applySuggestion } from "@/app/actions";

type F = { value: string | null; seen_text: string | null } | null;
type S = {
  product_name: F;
  price_amount: number | null;
  price_currency: string | null;
  price_seen_text: string | null;
  dimensions: F;
  colour: F;
  material: F;
  supplier_or_shop: F;
  platform: F;
  model_number: F;
  caution: string | null;
  extracted_at?: string;
};

const LABELS: [keyof S, string][] = [
  ["product_name", "Name"],
  ["dimensions", "Dimensions"],
  ["colour", "Colour"],
  ["material", "Material"],
  ["supplier_or_shop", "Shop"],
  ["model_number", "Model"],
];

export function SuggestionPanel({ optionId, suggestions, hasPhotos }: { optionId: string; suggestions: S | null; hasPhotos: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = () =>
    start(async () => {
      setError(null);
      const r = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }) });
      if (!r.ok) setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Could not read the screenshot");
      router.refresh();
    });
  const apply = (f: Parameters<typeof applySuggestion>[1]) =>
    start(async () => {
      const r = await applySuggestion(optionId, f);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  return (
    <div className="card mt-6 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-champagne-deep" />
        <div className="eyebrow">Suggested from screenshot · unverified</div>
      </div>
      {!suggestions ? (
        <div className="mt-3">
          <p className="text-[14px] text-muted">Let the app read the name, price and specifications it can see. Nothing is saved until you choose “Use”.</p>
          <button type="button" className="btn btn-quiet btn-sm mt-3" disabled={pending || !hasPhotos} onClick={run}>
            {pending ? "Reading…" : hasPhotos ? "Read details from screenshot" : "Add a screenshot first"}
          </button>
        </div>
      ) : (
        <>
          {suggestions.caution && <p className="mt-2 text-[13px] text-amber">{suggestions.caution}</p>}
          <ul className="mt-3 divide-y hairline text-[14px]">
            {suggestions.price_amount !== null && (
              <li className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="text-muted">Price: </span>
                  {suggestions.price_amount} {suggestions.price_currency ?? "(currency not visible)"}
                  {suggestions.price_seen_text && <span className="block text-[12px] text-muted">Seen: “{suggestions.price_seen_text}”</span>}
                </span>
                <button className="btn btn-quiet btn-sm" disabled={pending} onClick={() => apply("price")}>Use</button>
              </li>
            )}
            {LABELS.map(([k, label]) => {
              const f = suggestions[k] as F;
              if (!f?.value) return null;
              return (
                <li key={k} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="text-muted">{label}: </span>
                    {f.value}
                  </span>
                  <button className="btn btn-quiet btn-sm" disabled={pending} onClick={() => apply(k as never)}>Use</button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="mt-3 text-[13px] text-muted underline underline-offset-4" disabled={pending} onClick={run}>
            {pending ? "Reading…" : "Read again"}
          </button>
        </>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-rose">{error}</p>}
    </div>
  );
}
