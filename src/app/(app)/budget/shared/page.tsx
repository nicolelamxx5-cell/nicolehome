import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, SectionTitle, Notice } from "@/components/ui";
import { ActionForm } from "@/components/action";
import { saveSharedCost } from "@/app/actions";
import { formatMoney } from "@/lib/money";
import { CURRENCIES } from "@/lib/labels";

export const metadata = { title: "Shared costs" };

export default async function SharedPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const mayEdit = can(ctx.member, "payments");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/budget", label: "Budget" }} eyebrow="Budget" title="Shared costs" subtitle="Costs that serve many items, like your consolidated China container. Counted once, then shared out for display." />
      <Notice>Per-item freight allowances on options are separate. If you plan the container here, leave each China option’s freight blank so it is not counted twice.</Notice>
      <div className="mt-4 space-y-3">
        {data.summary.shared.map((s) => {
          const row = data.shared.find((x) => x.id === s.id)!;
          return (
            <div key={s.id} className="card p-5">
              <div className="flex justify-between gap-3">
                <div className="font-medium">{s.name}</div>
                <div className="tabular-nums">{formatMoney(s.amount)}</div>
              </div>
              <div className="text-[12px] text-muted">
                {row.status} · paid {formatMoney(s.paid)} · split {row.allocation === "by_value" ? "by approved value" : "equally"} across {row.applies_to === "china" ? "approved China items" : "all approved items"}
              </div>
              {s.allocation.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {s.allocation.map((a) => (
                    <li key={a.itemId} className="flex justify-between"><span>{itemName.get(a.itemId)}</span><span className="tabular-nums">{formatMoney(a.cents)}</span></li>
                  ))}
                </ul>
              )}
              {mayEdit && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[13px] text-muted">Edit</summary>
                  <SharedForm row={row} />
                </details>
              )}
            </div>
          );
        })}
      </div>
      {mayEdit && (
        <>
          <SectionTitle>Add a shared cost</SectionTitle>
          <div className="card p-5">
            <SharedForm />
          </div>
        </>
      )}
    </div>
  );
}

function SharedForm({ row }: { row?: { id: string; name: string; amount: number; currency: string; status: string; allocation: string; applies_to: string; notes: string | null } }) {
  return (
    <ActionForm action={saveSharedCost} submitLabel="Save" reset={!row}>
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name</label>
          <input name="name" className="field" defaultValue={row?.name ?? "China container freight & clearance"} required />
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <div>
            <label className="label">Amount</label>
            <input name="amount" type="number" step="0.01" min="0" className="field" defaultValue={row?.amount ?? ""} required />
          </div>
          <div>
            <label className="label">Currency</label>
            <select name="currency" className="field" defaultValue={row?.currency ?? "SGD"}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" className="field" defaultValue={row?.status ?? "forecast"}>
            <option value="forecast">Estimate (forecast only)</option>
            <option value="committed">Agreed (counts as committed)</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="label">Split</label>
          <select name="allocation" className="field" defaultValue={row?.allocation ?? "by_value"}>
            <option value="by_value">By approved value</option>
            <option value="equal">Equally</option>
          </select>
        </div>
        <div>
          <label className="label">Across</label>
          <select name="applies_to" className="field" defaultValue={row?.applies_to ?? "china"}>
            <option value="china">Approved China items</option>
            <option value="all">All approved items</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <input name="notes" className="field" defaultValue={row?.notes ?? ""} />
        </div>
      </div>
    </ActionForm>
  );
}
