import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, SectionTitle, Notice } from "@/components/ui";
import { ActionForm, ActionButton } from "@/components/action";
import { addRate, fetchReferenceRate } from "@/app/actions";
import { CURRENCIES } from "@/lib/labels";

export const metadata = { title: "Exchange rates" };

export default async function RatesPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const mayEdit = can(ctx.member, "payments") || can(ctx.member, "budget");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
  const latest = [...data.rateMap.values()];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/budget", label: "Budget" }} eyebrow="Budget" title="Exchange rates" subtitle="Used to estimate foreign prices in SGD. Approved costs and payments keep the rate they were saved with." />
      <div className="card divide-y hairline text-[14px]">
        {latest.length === 0 && <p className="p-4 text-muted">No rates yet. Add one before approving anything priced in RMB.</p>}
        {latest.map((r) => (
          <div key={r.currency} className="flex justify-between gap-3 px-4 py-3">
            <span className="font-medium">1 {r.currency}</span>
            <span className="text-right tabular-nums">
              S${Number(r.rate_to_sgd)}
              <span className="block text-[12px] text-muted">{r.source} · {r.as_of}</span>
            </span>
          </div>
        ))}
      </div>
      {mayEdit && (
        <>
          <SectionTitle>Get a reference rate</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {["CNY", "USD", "HKD"].map((c) => (
              <ActionButton key={c} action={fetchReferenceRate.bind(null, c)} className="btn btn-quiet btn-sm">
                Fetch {c} → SGD
              </ActionButton>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">European Central Bank reference rates. Your bank, card or Alipay rate will differ — enter the actual rate below when you know it.</p>
          <SectionTitle>Enter a rate</SectionTitle>
          <div className="card p-5">
            <ActionForm action={addRate} reset submitLabel="Save rate">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="currency">Currency</label>
                  <select id="currency" name="currency" className="field" defaultValue="CNY">
                    {CURRENCIES.filter((c) => c !== "SGD").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="rate">S$ per 1 unit</label>
                  <input id="rate" name="rate" type="number" step="any" min="0" inputMode="decimal" required className="field" placeholder="e.g. 0.185" />
                </div>
                <div>
                  <label className="label" htmlFor="as_of">Date</label>
                  <input id="as_of" name="as_of" type="date" defaultValue={today} className="field" />
                </div>
                <div>
                  <label className="label" htmlFor="source">Source</label>
                  <input id="source" name="source" defaultValue="Manual" className="field" required />
                </div>
              </div>
            </ActionForm>
          </div>
        </>
      )}
      {data.rates.length > latest.length && (
        <>
          <SectionTitle>History</SectionTitle>
          <ul className="card divide-y hairline text-[13px]">
            {data.rates.map((r) => (
              <li key={r.id} className="flex justify-between px-4 py-2 tabular-nums">
                <span>{r.currency} · {r.as_of}</span>
                <span>{Number(r.rate_to_sgd)} <span className="text-muted">({r.source})</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-6">
        <Notice>Base currency is SGD. A price with no confirmed currency is never converted — it is shown as “currency not confirmed”.</Notice>
      </div>
    </div>
  );
}
