import Link from "next/link";
import { ArrowRight, Compass, Plane, Search, Store } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadBudget, coverImages } from "@/lib/queries";
import { PageHeader, Thumb, Notice } from "@/components/ui";
import { ItemRow } from "@/components/item-row";

export const metadata = { title: "Shop" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; review?: string }> }) {
  const { q, review } = await searchParams;
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const lines = new Map(data.summary.items.map((l) => [l.itemId, l]));
  const active = data.items.filter((i) => !i.is_archived);

  // Cover image per room: first option with a photo
  const optionsByRoom = new Map<string, string[]>();
  const itemRoom = new Map(active.map((i) => [i.id, i.room_id]));
  for (const o of data.options) {
    const r = itemRoom.get(o.required_item_id);
    if (!r || o.status === "cancelled") continue;
    optionsByRoom.set(r, [...(optionsByRoom.get(r) ?? []), o.id]);
  }
  const covers = await coverImages(ctx, data.options.map((o) => o.id));
  const roomCover = (roomId: string) => (optionsByRoom.get(roomId) ?? []).map((id) => covers.get(id)).find(Boolean);

  const term = q?.trim().toLowerCase();
  const filtered = term
    ? active.filter((i) => `${i.name} ${i.specification ?? ""} ${i.legacy_id ?? ""} ${i.workbook_category ?? ""}`.toLowerCase().includes(term))
    : review
      ? active.filter((i) => i.needs_review)
      : null;
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));

  return (
    <div>
      <PageHeader eyebrow="Shop" title="Rooms" subtitle="Everything the home still needs, room by room." />

      <form className="relative mb-6" action="/shop">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" />
        <input name="q" defaultValue={q} placeholder="Search items, e.g. pendant, sink, 05-014" className="field pl-11" aria-label="Search items" />
      </form>

      {filtered ? (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              {filtered.length} item{filtered.length === 1 ? "" : "s"} {review ? "flagged for review" : `matching “${q}”`}
            </span>
            <Link href="/shop" className="underline underline-offset-4">Clear</Link>
          </div>
          {review && (
            <div className="mb-4">
              <Notice tone="warn">These rows may overlap with a row on another sheet. Open each one, read the note, and archive the duplicate or untick “needs review”.</Notice>
            </div>
          )}
          <div className="card divide-y hairline overflow-hidden">
            {filtered.map((i) => (
              <ItemRow key={i.id} item={i} line={lines.get(i.id)} roomName={roomName.get(i.room_id)} />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.rooms.map((room) => {
              const items = active.filter((i) => i.room_id === room.id);
              const approved = items.filter((i) => lines.get(i.id)?.activeApprovalId).length;
              const withOptions = items.filter((i) => (lines.get(i.id)?.optionCount ?? 0) > 0).length;
              return (
                <Link key={room.id} href={`/rooms/${room.id}`} className="group card overflow-hidden transition hover:border-taupe">
                  <Thumb src={roomCover(room.id)} alt={room.name} className="aspect-[4/3] w-full" />
                  <div className="p-3 sm:p-4">
                    <div className="font-display text-lg leading-tight sm:text-xl">{room.name}</div>
                    <div className="mt-1 text-[12px] text-muted sm:text-[13px]">
                      {items.length} items · {withOptions} with options · {approved} approved
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/trip", icon: Plane, title: "Guangzhou & Foshan guide", text: "Destinations and what to look for" },
              { href: "/more/guide", icon: Compass, title: "Sourcing guide", text: "China or Singapore, by category" },
              { href: "/more/suppliers", icon: Store, title: "Suppliers", text: "Shops, WeChat and contacts" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="card flex items-center gap-4 p-4 transition hover:border-taupe">
                <l.icon className="h-5 w-5 shrink-0 text-champagne-deep" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-[13px] text-muted">{l.text}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-stone" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
