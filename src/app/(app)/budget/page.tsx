import Link from "next/link";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { groupLines, FORECAST_BASIS_LABEL } from "@/lib/finance";
import { PageHeader, Money, Notice, SectionTitle } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Budget" };

function Figure({ label, cents, help, testId, href, strong }: { label: string; cents: number | null; help: string; testId: string; href?: string; strong?: boolean }) {
  const inner = (
    <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <div className={`text-[15px] ${strong ? "font-medium" : ""}`}>{label}</div>
        <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{help}</div>
      </div>
      <div className={`shrink-0 text-right tabular-nums ${strong ? "font-display text-2xl" : "text-[17px]"}`} data-testid={testId}>
        {cents === null ? <span className="text-[14px] text-muted">Not set</span> : <Money cents={cents} />}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:bg-linen/50">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function BudgetPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const s = data.summary;
  const byRoom = groupLines(s, (l) => l.roomId);
  const byCat = groupLines(s, (l) => l.categoryId);
  const itemMap = new Map(data.items.map((i) => [i.id, i]));
  const optionTitle = new Map(data.options.map((o) => [o.id, o.title]));
  const approvedLines = s.items.filter((l) => l.activeApprovalId);
  const sharedForecast = s.shared.reduce((a, x) => a + x.forecast, 0);
  const sumRooms = (k: "forecast" | "approved" | "paid" | "outstanding") => [...byRoom.values()].reduce((a, g) => a + g[k], 0);

  return (
    <div>
      <PageHeader eyebrow="Budget" title="Where the money stands" subtitle="All amounts in SGD. Tap a figure to see the records behind it.">
        {can(ctx.member, "payments") && <Link href="/budget/payments/new" className="btn btn-primary btn-sm">Record payment</Link>}
        {can(ctx.member, "budget") && <Link href="/budget/plan" className="btn btn-quiet btn-sm">Set budgets</Link>}
      </PageHeader>

      {s.warnings.map((w) => (
        <div key={w} className="mb-3">
          <Notice tone="warn">{w}</Notice>
        </div>
      ))}

      <div className="card divide-y hairline overflow-hidden">
        <Figure strong label="Total budget" cents={s.totalBudget} testId="total-budget" help="The amount you have set aside for the whole renovation." href={can(ctx.member, "budget") ? "/budget/plan" : undefined} />
        <Figure
          label="Forecast final cost"
          cents={s.forecastFinalCost}
          testId="forecast"
          help={`Approved choices, plus your allowance for everything not yet chosen (or the highest shortlisted price), plus shared costs and contingency. ${s.itemsWithoutEstimate} item${s.itemsWithoutEstimate === 1 ? " has" : "s have"} no estimate yet.`}
          href="#rooms"
        />
        <Figure label="Approved commitments" cents={s.approvedCommitments} testId="approved-commitments" help="Only the one approved option per item counts. Shortlisted options never count here." href="#approved" />
        <Figure label="Actual paid" cents={s.actualPaid} testId="actual-paid" help="Every confirmed payment, minus refunds. Paying does not add to commitments." href="/budget/payments" />
        <Figure label="Outstanding on approved choices" cents={s.outstanding} testId="outstanding" help="What is still owed on current approvals: approved cost minus what has been paid against it." href="#approved" />
        {s.replacedSpend !== 0 && (
          <Figure label="Paid towards replaced or cancelled choices" cents={s.replacedSpend} testId="replaced-spend" help="Deposits on choices you later changed or cancelled. Counted in paid, never added to the new choice. Record refunds if you get money back." href="/budget/payments" />
        )}
        {s.unreconciledPaid !== 0 && (
          <Figure label="Payments not linked to an approval" cents={s.unreconciledPaid} testId="unreconciled" help="Usually imported from the workbook. Link them to the right item when you can." href="/budget/payments" />
        )}
        <Figure
          strong
          label="Remaining vs commitments"
          cents={s.remainingVsCommitted}
          testId="remaining-committed"
          help="Total budget minus everything approved or already spent. This is what is still uncommitted."
        />
        <Figure label="Remaining vs forecast" cents={s.remainingVsForecast} testId="remaining-forecast" help="Total budget minus the forecast final cost. Negative means the plan is over budget." />
      </div>

      <SectionTitle>By room</SectionTitle>
      <div id="rooms" className="card overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[14px]">
          <thead className="text-left text-[12px] text-muted">
            <tr>
              <th className="p-3 pl-4 font-normal">Room</th>
              <th className="p-3 text-right font-normal">Budget</th>
              <th className="p-3 text-right font-normal">Forecast</th>
              <th className="p-3 text-right font-normal">Approved</th>
              <th className="p-3 text-right font-normal">Paid</th>
              <th className="p-3 pr-4 text-right font-normal">Outstanding</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.rooms.map((r) => {
              const g = byRoom.get(r.id);
              return (
                <tr key={r.id} className="border-t hairline">
                  <td className="p-3 pl-4">
                    <Link href={`/rooms/${r.id}`} className="hover:underline">{r.name}</Link>
                    {g && g.shared > 0 && <div className="text-[11px] text-muted">+ {formatMoney(g.shared)} shared freight share</div>}
                  </td>
                  <td className="p-3 text-right text-muted">{r.budget === null ? "—" : formatMoney(Math.round(Number(r.budget) * 100))}</td>
                  <td className="p-3 text-right">{formatMoney(g?.forecast ?? 0)}</td>
                  <td className="p-3 text-right">{formatMoney(g?.approved ?? 0)}</td>
                  <td className="p-3 text-right">{formatMoney(g?.paid ?? 0)}</td>
                  <td className="p-3 pr-4 text-right">{formatMoney(g?.outstanding ?? 0)}</td>
                </tr>
              );
            })}
            {(sharedForecast > 0 || s.shared.length > 0) && (
              <tr className="border-t hairline">
                <td className="p-3 pl-4"><Link href="/budget/shared" className="hover:underline">Shared costs (e.g. container)</Link></td>
                <td className="p-3 text-right text-muted">—</td>
                <td className="p-3 text-right">{formatMoney(sharedForecast)}</td>
                <td className="p-3 text-right">{formatMoney(s.shared.reduce((a, x) => a + x.committed, 0))}</td>
                <td className="p-3 text-right">{formatMoney(s.shared.reduce((a, x) => a + x.paid, 0))}</td>
                <td className="p-3 pr-4 text-right">{formatMoney(s.shared.reduce((a, x) => a + x.outstanding, 0))}</td>
              </tr>
            )}
            {s.contingency > 0 && (
              <tr className="border-t hairline">
                <td className="p-3 pl-4">Contingency</td>
                <td className="p-3 text-right text-muted">—</td>
                <td className="p-3 text-right">{formatMoney(s.contingency)}</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 pr-4 text-right">—</td>
              </tr>
            )}
            <tr className="border-t hairline font-medium">
              <td className="p-3 pl-4">Total</td>
              <td className="p-3 text-right">{s.totalBudget === null ? "—" : formatMoney(s.totalBudget)}</td>
              <td className="p-3 text-right">{formatMoney(sumRooms("forecast") + sharedForecast + s.contingency + s.unassignedPayments)}</td>
              <td className="p-3 text-right">{formatMoney(sumRooms("approved") + s.shared.reduce((a, x) => a + x.committed, 0))}</td>
              <td className="p-3 text-right">{formatMoney(sumRooms("paid") + s.shared.reduce((a, x) => a + x.paid, 0) + s.unassignedPayments)}</td>
              <td className="p-3 pr-4 text-right">{formatMoney(sumRooms("outstanding") + s.shared.reduce((a, x) => a + x.outstanding, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data.categories.length > 0 && (
        <>
          <SectionTitle>By category</SectionTitle>
          <div className="card divide-y hairline text-[14px]">
            {data.categories.map((c) => {
              const g = byCat.get(c.id);
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-muted">
                    {formatMoney(g?.approved ?? 0)} approved · {formatMoney(g?.forecast ?? 0)} forecast
                    {c.budget !== null && ` · ${formatMoney(Math.round(Number(c.budget) * 100))} budget`}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-muted">
              <span>Not categorised</span>
              <span className="tabular-nums">{formatMoney(byCat.get("none")?.approved ?? 0)} approved · {formatMoney(byCat.get("none")?.forecast ?? 0)} forecast</span>
            </div>
          </div>
        </>
      )}

      <SectionTitle>Approved choices</SectionTitle>
      <div id="approved" className="card divide-y hairline text-[14px]">
        {approvedLines.length === 0 && <p className="p-4 text-muted">Nothing approved yet — so nothing is committed.</p>}
        {approvedLines.map((l) => {
          const a = data.approvals.find((x) => x.id === l.activeApprovalId)!;
          return (
            <Link key={l.itemId} href={`/items/${l.itemId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-linen/50">
              <span className="min-w-0">
                <span className="block truncate">{itemMap.get(l.itemId)?.name}</span>
                <span className="block truncate text-[12px] text-muted">{optionTitle.get(a.option_id)}{a.needs_reconciliation ? " · imported, check" : ""}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                {formatMoney(l.approvedCost)}
                <span className="block text-[12px] text-muted">{formatMoney(l.outstanding)} to pay</span>
              </span>
            </Link>
          );
        })}
      </div>

      <SectionTitle>How the forecast is built</SectionTitle>
      <div className="card divide-y hairline text-[14px]">
        {(["approved", "allowance", "highest_shortlisted", "payments_only", "none"] as const).map((b) => {
          const ls = s.items.filter((l) => l.forecastBasis === b);
          return (
            <div key={b} className="flex justify-between gap-3 px-4 py-3">
              <span>{FORECAST_BASIS_LABEL[b]} <span className="text-muted">({ls.length} items)</span></span>
              <span className="tabular-nums">{formatMoney(ls.reduce((a, l) => a + l.forecast, 0))}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/budget/payments" className="btn btn-quiet btn-sm">Payments</Link>
        <Link href="/budget/rates" className="btn btn-quiet btn-sm">Exchange rates</Link>
        <Link href="/budget/shared" className="btn btn-quiet btn-sm">Shared costs &amp; freight</Link>
      </div>
    </div>
  );
}
