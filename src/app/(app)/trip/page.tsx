import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, Notice } from "@/components/ui";

export const metadata = { title: "Guangzhou & Foshan" };

export default async function TripPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const [{ data: locs }, { data: links }] = await Promise.all([
    ctx.supabase.from("shopping_locations").select("*").eq("household_id", ctx.household.id).order("sort_order"),
    ctx.supabase.from("location_items").select("location_id, required_item_id").eq("household_id", ctx.household.id),
  ]);
  const lines = new Map(data.summary.items.map((l) => [l.itemId, l]));
  const quoted = new Set(data.options.filter((o) => o.status !== "cancelled").map((o) => o.required_item_id));
  const h = ctx.household;
  const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }) : "");
  return (
    <div>
      <PageHeader eyebrow="Sourcing trip" title="Guangzhou & Foshan" subtitle={h.trip_start ? `${fmt(h.trip_start)} – ${fmt(h.trip_end)} ${h.trip_end?.slice(0, 4)}` : undefined} />
      <Notice>
        Addresses are shown only once you have verified them. Map buttons search the Chinese name. Before you fly, open each destination once while connected so it is saved on your phone for offline use.
      </Notice>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(locs ?? []).map((l) => {
          const ids = (links ?? []).filter((x) => x.location_id === l.id).map((x) => x.required_item_id);
          const open = ids.filter((id) => !lines.get(id)?.activeApprovalId);
          const noOptions = open.filter((id) => !quoted.has(id));
          return (
            <Link key={l.id} href={`/trip/${l.id}`} className="card flex items-center gap-4 p-5 transition hover:border-taupe">
              <div className="min-w-0 flex-1">
                <div className="eyebrow">{l.city}</div>
                <div className="font-display text-xl leading-tight">{l.name_en}</div>
                {l.name_zh && <div className="text-[15px] text-ink">{l.name_zh}</div>}
                <div className="mt-2 text-[13px] text-muted">
                  {open.length} item{open.length === 1 ? "" : "s"} to look for · {noOptions.length} with no options yet
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-stone" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
