import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { cardData } from "@/lib/option-data";
import { PageHeader, EmptyState } from "@/components/ui";
import { OptionCard } from "@/components/option-card";

export const metadata = { title: "Wishlist" };

const TABS = [
  { key: "all", label: "All" },
  { key: "wishlist", label: "New" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "pending_confirmation", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "ordered", label: "Ordered" },
  { key: "cancelled", label: "Not chosen" },
];

export default async function WishlistPage({ searchParams }: { searchParams: Promise<{ status?: string; room?: string }> }) {
  const { status = "all", room } = await searchParams;
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  let q = ctx.supabase.from("product_options").select("*").eq("household_id", ctx.household.id).order("updated_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status as never);
  else q = q.neq("status", "cancelled");
  const { data: options } = await q;
  const itemMap = new Map(data.items.map((i) => [i.id, i]));
  const filtered = (options ?? []).filter((o) => !room || itemMap.get(o.required_item_id)?.room_id === room);
  const cards = await cardData(ctx, filtered, data.rateMap);
  const itemName = new Map(filtered.map((o) => [o.id, itemMap.get(o.required_item_id)?.name]));

  const href = (s: string, r?: string) => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (r) p.set("room", r);
    const qs = p.toString();
    return `/wishlist${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader eyebrow="Wishlist" title="Everything you’ve saved" />
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key, room)} className={`chip px-4 py-1.5 text-[13px] ${status === t.key ? "bg-graphite text-ivory" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
        <Link href={href(status)} className={`chip ${!room ? "bg-greige" : ""}`}>All rooms</Link>
        {data.rooms.map((r) => (
          <Link key={r.id} href={href(status, r.id)} className={`chip ${room === r.id ? "bg-greige" : ""}`}>
            {r.name}
          </Link>
        ))}
      </div>
      {cards.length === 0 ? (
        <EmptyState title="Nothing here yet" action={<Link href="/add" className="btn btn-primary">Add a product</Link>}>
          Screenshots and links you save appear here.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <OptionCard key={c.id} o={c} itemName={itemName.get(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
