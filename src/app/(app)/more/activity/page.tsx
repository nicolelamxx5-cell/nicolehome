import { getContext } from "@/lib/context";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Activity" };

const ENTITY: Record<string, string> = {
  product_options: "option",
  required_items: "item",
  approvals: "approval",
  payments: "payment",
  option_comments: "comment",
  option_preferences: "vote",
  option_images: "photo",
  option_checks: "check",
  exchange_rates: "exchange rate",
  households: "household",
  household_members: "member",
  household_invites: "invitation",
  rooms: "room",
  shared_costs: "shared cost",
  import_batches: "workbook import",
  suppliers: "supplier",
  shopping_locations: "trip destination",
  location_items: "trip checklist",
  budget_categories: "budget category",
  documents: "document",
};
const ACTION: Record<string, string> = { insert: "added", update: "changed", delete: "removed" };

function describe(row: { action: string; entity: string; changes: unknown }) {
  const c = (row.changes ?? {}) as Record<string, unknown>;
  const what = ENTITY[row.entity] ?? row.entity;
  const label = (c.title ?? c.name ?? c.body) as string | undefined;
  if (row.entity === "approvals" && row.action === "update" && Array.isArray(c.status)) return `approval ${c.status[0]} → ${c.status[1]}`;
  if (row.action === "update") {
    const keys = Object.keys(c).filter((k) => !["import_snapshot", "updated_at"].includes(k));
    return `${what} changed: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}`;
  }
  return `${what} ${ACTION[row.action] ?? row.action}${label && typeof label === "string" ? `: “${label.slice(0, 60)}”` : ""}`;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const { supabase, household, names } = await getContext();
  let q = supabase.from("audit_log").select("*").eq("household_id", household.id).neq("entity", "location_items").order("id", { ascending: false }).limit(100);
  if (before) q = q.lt("id", Number(before));
  const { data: rows } = await q;
  const last = rows?.at(-1)?.id;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Household" title="Activity" subtitle="Recorded automatically by the database." />
      <ul className="card divide-y hairline text-[14px]">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div>{describe(r)}</div>
            <div className="text-[12px] text-muted">
              {r.actor_id ? names.get(r.actor_id) ?? "Someone" : "System"} · {new Date(r.created_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </li>
        ))}
      </ul>
      {rows?.length === 100 && last && (
        <a href={`/more/activity?before=${last}`} className="btn btn-quiet btn-sm mt-4">Older</a>
      )}
    </div>
  );
}
