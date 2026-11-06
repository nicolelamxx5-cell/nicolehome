import Link from "next/link";
import { Thumb, StatusPill } from "@/components/ui";
import { formatMoney, toCents } from "@/lib/money";
import { VOTE_LABEL, PLATFORM_LABEL } from "@/lib/labels";

export interface OptionCardData {
  id: string;
  title: string;
  status: string;
  supplier_name: string | null;
  platform: string;
  price: number | null;
  currency: string | null;
  price_basis: string;
  landedCents: number | null;
  landedNote: string | null;
  cover?: string;
  votes: { name: string; vote: string }[];
  readiness?: string;
  imageCount?: number;
}

export function OptionCard({ o, itemName }: { o: OptionCardData; itemName?: string }) {
  const priceCents = toCents(o.price);
  return (
    <Link href={`/options/${o.id}`} className="card group flex h-full flex-col overflow-hidden transition hover:border-taupe" data-testid="option-card">
      <div className="relative">
        <Thumb src={o.cover} alt={o.title} className="aspect-[4/3] w-full" />
        <div className="absolute left-3 top-3">
          <StatusPill status={o.status} />
        </div>
        {(o.imageCount ?? 0) > 1 && <span className="chip absolute bottom-3 right-3 bg-paper/90">{o.imageCount} photos</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {itemName && <div className="eyebrow mb-1 truncate">{itemName}</div>}
        <div className="line-clamp-2 font-medium leading-snug">{o.title}</div>
        <div className="mt-1 truncate text-[13px] text-muted">
          {[o.supplier_name, PLATFORM_LABEL[o.platform] ?? o.platform].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[15px] tabular-nums">
              {priceCents === null ? (
                <span className="text-muted">No price yet</span>
              ) : o.currency ? (
                formatMoney(priceCents, o.currency)
              ) : (
                <span>
                  {(priceCents / 100).toLocaleString("en-SG")} <span className="text-amber">· currency?</span>
                </span>
              )}
            </div>
            <div className="text-[12px] text-muted">
              {o.landedCents !== null ? <>≈ {formatMoney(o.landedCents)} landed</> : o.landedNote}
            </div>
          </div>
          {o.price_basis === "observed" && priceCents !== null && <span className="chip bg-amber/10 text-amber">Unverified</span>}
        </div>
        {o.votes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {o.votes.map((v) => (
              <span key={v.name} className="chip">
                {v.name}: {VOTE_LABEL[v.vote]}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
