import { redirect } from "next/navigation";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action";
import { recordPayment } from "@/app/actions";
import { formatMoney } from "@/lib/money";
import { CURRENCIES, PAYMENT_KIND_LABEL } from "@/lib/labels";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ target?: string }> }) {
  const { target } = await searchParams;
  const ctx = await getContext();
  if (!can(ctx.member, "payments")) redirect("/budget/payments");
  const data = await loadBudget(ctx);
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const optionTitle = new Map(data.options.map((o) => [o.id, o.title]));
  const lines = new Map(data.summary.items.map((l) => [l.itemId, l]));
  const active = data.approvals.filter((a) => a.status === "active");
  const ended = data.approvals.filter((a) => a.status !== "active");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: "/budget/payments", label: "Payments" }} eyebrow="Budget" title="Record a payment" subtitle="Only record money that has actually been paid (or refunded)." />
      <div className="card p-5">
        <ActionForm action={recordPayment} submitLabel="Save payment">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="target">For</label>
              <select id="target" name="target" defaultValue={target ?? ""} className="field" required>
                <option value="" disabled>Choose an approved choice…</option>
                <optgroup label="Approved choices">
                  {active.map((a) => (
                    <option key={a.id} value={`approval:${a.id}`}>
                      {itemName.get(a.required_item_id)} — {optionTitle.get(a.option_id)} ({formatMoney(lines.get(a.required_item_id)?.outstanding ?? 0)} outstanding)
                    </option>
                  ))}
                </optgroup>
                {data.shared.length > 0 && (
                  <optgroup label="Shared costs">
                    {data.shared.map((s) => (
                      <option key={s.id} value={`shared:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
                {ended.length > 0 && (
                  <optgroup label="Replaced or cancelled choices (e.g. refunds)">
                    {ended.map((a) => (
                      <option key={a.id} value={`approval:${a.id}`}>
                        {itemName.get(a.required_item_id)} — {optionTitle.get(a.option_id)} ({a.status})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Not approved yet (will be flagged)">
                  {data.items
                    .filter((i) => !i.is_archived && !lines.get(i.id)?.activeApprovalId)
                    .map((i) => (
                      <option key={i.id} value={`item:${i.id}`}>{i.name}</option>
                    ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="kind">Type</label>
              <select id="kind" name="kind" className="field" defaultValue="deposit">
                {Object.entries(PAYMENT_KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div>
                <label className="label" htmlFor="amount">Amount</label>
                <input id="amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required className="field" />
              </div>
              <div>
                <label className="label" htmlFor="currency">Currency</label>
                <select id="currency" name="currency" className="field" defaultValue="SGD">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="fx_rate">Exchange rate used (S$ per unit, only for foreign currency)</label>
              <input id="fx_rate" name="fx_rate" type="number" step="any" min="0" inputMode="decimal" className="field" placeholder="Leave blank to use the latest saved rate" />
            </div>
            <div>
              <label className="label" htmlFor="paid_on">Date paid</label>
              <input id="paid_on" name="paid_on" type="date" defaultValue={today} required className="field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="method">Method</label>
                <input id="method" name="method" className="field" placeholder="PayNow, Alipay…" />
              </div>
              <div>
                <label className="label" htmlFor="reference">Invoice / reference</label>
                <input id="reference" name="reference" className="field" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" className="field" />
            </div>
            <p className="text-[12px] text-muted">The SGD value is fixed when you save, so later rate changes don’t alter it.</p>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
