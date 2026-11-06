import Link from "next/link";
import { getContext } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Approval history" };

export default async function ApprovalsPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const optionTitle = new Map(data.options.map((o) => [o.id, o.title]));
  const rows = [...data.approvals].reverse();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/more", label: "More" }} eyebrow="Decisions" title="Approval history" />
      {rows.length === 0 ? (
        <EmptyState title="No approvals yet" />
      ) : (
        <ul className="card divide-y hairline text-[14px]">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/items/${a.required_item_id}`} className="block px-4 py-3 hover:bg-linen/50">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{itemName.get(a.required_item_id)}</span>
                  <span className="tabular-nums">{formatMoney(Math.round(Number(a.cost_sgd) * 100))}</span>
                </div>
                <div className="text-[12px] text-muted">
                  {optionTitle.get(a.option_id)} · {a.status === "active" ? (a.ordered_at ? "approved & ordered" : "approved") : a.status} · {new Date(a.approved_at).toLocaleDateString("en-SG")} by {ctx.names.get(a.approved_by ?? "") ?? "—"}
                  {a.end_reason && ` · ${a.end_reason}`}
                  {(a.unresolved_checks as unknown[]).length > 0 && ` · ${(a.unresolved_checks as unknown[]).length} check(s) open at approval`}
                  {a.order_override_note && ` · ordered with override: ${a.order_override_note}`}
                  {a.is_imported && " · imported from workbook"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
