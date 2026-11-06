import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getContext } from "@/lib/context";
import { loadBudget, coverImages } from "@/lib/queries";
import { PageHeader, Notice, SectionTitle, Thumb, EmptyState } from "@/components/ui";
import { ActionForm, ActionButton } from "@/components/action";
import { CopyButton } from "@/components/copy-button";
import { toggleLocationItem, updateLocation } from "@/app/actions";
import { mapLinks } from "@/lib/maps";
import { itemState } from "@/components/item-row";

export default async function LocationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const ctx = await getContext();
  const { data: loc } = await ctx.supabase.from("shopping_locations").select("*").eq("id", locationId).maybeSingle();
  if (!loc) notFound();
  const data = await loadBudget(ctx);
  const { data: links } = await ctx.supabase.from("location_items").select("required_item_id").eq("location_id", locationId);
  const linked = new Set((links ?? []).map((l) => l.required_item_id));
  const lines = new Map(data.summary.items.map((l) => [l.itemId, l]));
  const items = data.items.filter((i) => linked.has(i.id) && !i.is_archived);
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const optsByItem = new Map<string, typeof data.options>();
  for (const o of data.options) if (o.status !== "cancelled") optsByItem.set(o.required_item_id, [...(optsByItem.get(o.required_item_id) ?? []), o]);
  const covers = await coverImages(ctx, items.flatMap((i) => (optsByItem.get(i.id) ?? []).slice(0, 3).map((o) => o.id)));
  const { data: fullOpts } = await ctx.supabase
    .from("product_options")
    .select("required_item_id, supplier_name, contact, price_basis")
    .in("required_item_id", items.map((i) => i.id).length ? items.map((i) => i.id) : ["00000000-0000-0000-0000-000000000000"]);
  const open = items.filter((i) => !lines.get(i.id)?.activeApprovalId);
  const done = items.filter((i) => lines.get(i.id)?.activeApprovalId);
  const addable = data.items.filter((i) => !linked.has(i.id) && !i.is_archived && i.sourcing !== "singapore");

  const ItemCard = ({ item }: { item: (typeof items)[number] }) => {
    const opts = optsByItem.get(item.id) ?? [];
    const full = (fullOpts ?? []).filter((o) => o.required_item_id === item.id);
    const suppliers = [...new Set(full.map((o) => [o.supplier_name, o.contact].filter(Boolean).join(" · ")).filter(Boolean))];
    const needsQuote = !full.some((o) => o.price_basis === "quoted" || o.price_basis === "confirmed");
    const st = itemState(lines.get(item.id));
    return (
      <div className="card p-4" data-testid="trip-item">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/items/${item.id}`} className="min-w-0">
            <div className="font-medium leading-snug hover:underline">{item.name}</div>
            <div className="text-[12px] text-muted">{[roomName.get(item.room_id), item.priority_label && `Priority: ${item.priority_label}`].filter(Boolean).join(" · ")}</div>
          </Link>
          <span className={`shrink-0 text-[12px] ${st.tone}`}>{st.label}</span>
        </div>
        {opts.length > 0 && (
          <div className="mt-3 flex gap-2">
            {opts.slice(0, 3).map((o) => (
              <Link key={o.id} href={`/options/${o.id}`}>
                <Thumb src={covers.get(o.id)} alt={o.title} className="h-16 w-16 rounded-xl" />
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3 space-y-1 text-[13px]">
          {suppliers.length > 0 && <div><span className="text-muted">Contacted:</span> {suppliers.join("; ")}</div>}
          {needsQuote && !lines.get(item.id)?.activeApprovalId && <div className="text-amber">Needs a quotation</div>}
          {item.dimensions_finish && <div><span className="text-muted">Spec:</span> {item.dimensions_finish}</div>}
          {item.notes && <div className="text-muted">{item.notes}</div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/add?item=${item.id}`} className="btn btn-primary btn-sm">Add what I found</Link>
          <ActionButton action={toggleLocationItem.bind(null, locationId, item.id, false)} className="btn btn-ghost btn-sm">Remove from list</ActionButton>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader back={{ href: "/trip", label: "Trip" }} eyebrow={loc.city ?? "Destination"} title={loc.name_en} subtitle={loc.name_zh ?? undefined} />
      <div className="card p-5">
        {loc.address_verified && loc.address ? (
          <div className="text-[15px]"><MapPin className="mr-1 inline h-4 w-4 text-champagne-deep" />{loc.address}</div>
        ) : (
          <p className="text-[14px] text-muted">{loc.verification_note ?? "Address not yet verified."}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {mapLinks(loc.name_zh, loc.name_en, loc.city).map((m) => (
            <a key={m.label} href={m.href} target="_blank" rel="noreferrer noopener" className="btn btn-quiet btn-sm">{m.label}</a>
          ))}
          {loc.name_zh && <CopyButton text={loc.name_zh} label="Copy Chinese name (for DiDi / taxi)" />}
        </div>
        {loc.notes && <p className="mt-4 whitespace-pre-line text-[14px]">{loc.notes}</p>}
      </div>

      <SectionTitle>Look for ({open.length})</SectionTitle>
      {open.length === 0 ? (
        <EmptyState title="Nothing on this list">Add items below that you want to find here.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{open.map((i) => <ItemCard key={i.id} item={i} />)}</div>
      )}
      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[14px] text-muted">{done.length} already approved</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{done.map((i) => <ItemCard key={i.id} item={i} />)}</div>
        </details>
      )}

      <SectionTitle>Add an item to this list</SectionTitle>
      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row"
        action={async (fd) => {
          "use server";
          const id = String(fd.get("item") ?? "");
          if (id) await toggleLocationItem(locationId, id, true);
        }}
      >
        <select name="item" className="field flex-1" aria-label="Item to add">
          {addable.map((i) => (
            <option key={i.id} value={i.id}>{roomName.get(i.room_id)} — {i.name}</option>
          ))}
        </select>
        <button className="btn btn-quiet">Add</button>
      </form>
      <p className="mt-2 text-[12px] text-muted">An item can be on several destination lists — it is still budgeted once.</p>

      <SectionTitle>Notes &amp; address</SectionTitle>
      <div className="card p-5">
        <ActionForm action={updateLocation.bind(null, locationId)} submitLabel="Save">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="notes">Notes (opening hours, which halls, contacts)</label>
              <textarea id="notes" name="notes" defaultValue={loc.notes ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="address">Address</label>
              <input id="address" name="address" defaultValue={loc.address ?? ""} className="field" />
            </div>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" name="address_verified" defaultChecked={loc.address_verified} className="h-4 w-4 accent-graphite" /> I have verified this address (e.g. from the venue or a map pin)
            </label>
            <div>
              <label className="label" htmlFor="verification_note">How it was verified</label>
              <input id="verification_note" name="verification_note" defaultValue={loc.verification_note ?? ""} className="field" />
            </div>
          </div>
        </ActionForm>
      </div>
      <div className="mt-4"><Notice>If you are using a mainland China SIM or hotel Wi-Fi and the app will not load, switch to your Singapore roaming data. See the help notes in docs/CHINA_ACCESS.md.</Notice></div>
    </div>
  );
}
