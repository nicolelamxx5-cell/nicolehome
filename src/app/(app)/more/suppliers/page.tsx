import { getContext } from "@/lib/context";
import { PageHeader, EmptyState } from "@/components/ui";
import { PLATFORM_LABEL } from "@/lib/labels";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { supabase, household } = await getContext();
  const [{ data: suppliers }, { data: opts }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("household_id", household.id).order("name"),
    supabase.from("product_options").select("supplier_name, supplier_id, contact, url, platform").eq("household_id", household.id).not("supplier_name", "is", null),
  ]);
  // Suppliers typed on options but not yet saved as records
  const known = new Set((suppliers ?? []).map((s) => s.name.toLowerCase()));
  const loose = new Map<string, { contact: string | null; platform: string }>();
  for (const o of opts ?? []) if (o.supplier_name && !known.has(o.supplier_name.toLowerCase())) loose.set(o.supplier_name, { contact: o.contact, platform: o.platform });
  const count = (name: string, id?: string) => (opts ?? []).filter((o) => o.supplier_id === id || o.supplier_name === name).length;
  const empty = (suppliers ?? []).length === 0 && loose.size === 0;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Sourcing" title="Suppliers" subtitle="Collected from the options you save." />
      {empty ? (
        <EmptyState title="No suppliers yet">Add a supplier name or WeChat contact on an option and it appears here.</EmptyState>
      ) : (
        <ul className="card divide-y hairline text-[14px]">
          {(suppliers ?? []).map((s) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{s.name}</span>
                <span className="text-[12px] text-muted">{count(s.name, s.id)} option(s)</span>
              </div>
              <div className="text-[12px] text-muted">
                {[PLATFORM_LABEL[s.platform] ?? s.platform, s.wechat && `WeChat ${s.wechat}`, s.phone, s.city, s.address].filter(Boolean).join(" · ")}
              </div>
              {s.shop_url && <a href={s.shop_url} className="text-[12px] underline" target="_blank" rel="noreferrer noopener">{s.shop_url}</a>}
            </li>
          ))}
          {[...loose.entries()].map(([name, v]) => (
            <li key={name} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{name}</span>
                <span className="text-[12px] text-muted">{count(name)} option(s)</span>
              </div>
              <div className="text-[12px] text-muted">{[PLATFORM_LABEL[v.platform], v.contact].filter(Boolean).join(" · ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
