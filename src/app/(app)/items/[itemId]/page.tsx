import Link from "next/link";
import { notFound } from "next/navigation";
import { Columns3, Plus, MapPin } from "lucide-react";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { cardData } from "@/lib/option-data";
import { PageHeader, Money, Notice, SectionTitle, EmptyState } from "@/components/ui";
import { OptionCard } from "@/components/option-card";
import { ActionForm, ActionButton } from "@/components/action";
import { updateItem, archiveItem, markOrdered, revokeApproval, cancelApproval } from "@/app/actions";
import { SOURCING_LABEL } from "@/lib/labels";
import { FORECAST_BASIS_LABEL } from "@/lib/finance";
import { suggestSourcing, readiness, READINESS_LABEL } from "@/lib/requirements";
import { formatMoney } from "@/lib/money";

export default async function ItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const ctx = await getContext();
  const { supabase, member } = ctx;
  const data = await loadBudget(ctx);
  const item = data.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const room = data.rooms.find((r) => r.id === item.room_id)!;
  const line = data.summary.items.find((l) => l.itemId === itemId);

  const [{ data: options }, { data: locations }] = await Promise.all([
    supabase.from("product_options").select("*").eq("required_item_id", itemId).order("created_at"),
    supabase.from("location_items").select("location_id, shopping_locations(id, name_en, name_zh)").eq("required_item_id", itemId),
  ]);
  const cards = await cardData(ctx, options ?? [], data.rateMap);
  const live = cards.filter((c) => c.status !== "cancelled");
  const cancelled = cards.filter((c) => c.status === "cancelled");
  const approvals = data.approvals.filter((a) => a.required_item_id === itemId).reverse();
  const active = approvals.find((a) => a.status === "active");
  const activeOption = active ? (options ?? []).find((o) => o.id === active.option_id) : null;
  const { data: activeChecks } = active
    ? await supabase.from("option_checks").select("state, critical").eq("option_id", active.option_id)
    : { data: null };
  const ready = activeChecks ? readiness(activeChecks) : null;
  const suggestion = suggestSourcing(item);
  const canApprove = can(member, "approve");
  const optionTitle = new Map((options ?? []).map((o) => [o.id, o.title]));
  const payments = data.payments.filter((p) => p.required_item_id === itemId);

  return (
    <div>
      <PageHeader
        back={{ href: `/rooms/${room.id}`, label: room.name }}
        eyebrow={[item.legacy_id, room.name].filter(Boolean).join(" · ")}
        title={item.name}
        subtitle={item.specification && item.specification !== item.name ? item.specification : undefined}
      >
        {live.length >= 2 && (
          <Link href={`/items/${item.id}/compare`} className="btn btn-quiet btn-sm">
            <Columns3 className="h-4 w-4" /> Compare {live.length}
          </Link>
        )}
        <Link href={`/add?item=${item.id}`} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" /> Add option
        </Link>
      </PageHeader>

      {item.needs_review && item.review_note && (
        <div className="mb-4">
          <Notice tone="warn">
            <div className="font-medium">Check for overlap</div>
            <div className="mt-1 whitespace-pre-line">{item.review_note}</div>
          </Notice>
        </div>
      )}

      {/* Approved choice */}
      {active && activeOption ? (
        <div className="card mb-6 p-5" data-testid="approved-panel">
          <div className="eyebrow">Approved choice</div>
          <Link href={`/options/${activeOption.id}`} className="font-display mt-1 block text-2xl hover:underline">
            {activeOption.title}
          </Link>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-[14px] sm:grid-cols-4">
            <div>
              <dt className="text-muted">Committed</dt>
              <dd className="tabular-nums" data-testid="item-committed"><Money cents={line?.approvedCost} /></dd>
            </div>
            <div>
              <dt className="text-muted">Paid</dt>
              <dd className="tabular-nums" data-testid="item-paid"><Money cents={line?.paidOnActive} /></dd>
            </div>
            <div>
              <dt className="text-muted">Outstanding</dt>
              <dd className="tabular-nums" data-testid="item-outstanding"><Money cents={line?.outstanding} /></dd>
            </div>
            <div>
              <dt className="text-muted">Order status</dt>
              <dd>{active.ordered_at ? "Ordered" : ready ? READINESS_LABEL[ready] : "Approved"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-muted">
            Cost basis: {formatMoney(Math.round(Number(active.unit_price) * 100), active.currency)} × {Number(active.quantity)}
            {Number(active.other_charges) > 0 && ` + ${formatMoney(Math.round(Number(active.other_charges) * 100), active.currency)} charges`}
            {active.currency !== "SGD" && ` at ${Number(active.fx_rate)} (${active.fx_source}, ${active.fx_as_of})`}
            {Number(active.freight_sgd) > 0 && ` + ${formatMoney(Math.round(Number(active.freight_sgd) * 100))} freight`}. Approved{" "}
            {new Date(active.approved_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })} by {ctx.names.get(active.approved_by ?? "") ?? "—"}.
            {active.price_basis === "observed" && " Price was an unverified observation when approved."}
          </p>
          {(line?.replacedSpend ?? 0) !== 0 && (
            <div className="mt-3">
              <Notice tone="warn">
                {formatMoney(line!.replacedSpend)} was paid towards an earlier choice for this item. It stays in “Actual paid” but does not reduce what you owe for the current choice. Record a refund if you get it back.
              </Notice>
            </div>
          )}
          {canApprove && (
            <div className="mt-4 flex flex-wrap gap-2">
              {can(member, "payments") && (
                <Link href={`/budget/payments/new?target=approval:${active.id}`} className="btn btn-champagne btn-sm">
                  Record payment
                </Link>
              )}
              {!active.ordered_at && ready !== "do_not_order" && (
                <ActionButton action={markOrdered.bind(null, active.id)} className="btn btn-quiet btn-sm" confirm="Mark this choice as ordered? (This does not contact the supplier.)">
                  Mark as ordered
                </ActionButton>
              )}
              {!active.ordered_at && ready === "do_not_order" && (
                <ActionButton
                  action={markOrdered.bind(null, active.id)}
                  className="btn btn-quiet btn-sm"
                  prompt="Some critical checks are unresolved. To mark as ordered anyway, write why (this is recorded):"
                  promptRequired
                >
                  Mark as ordered (override)
                </ActionButton>
              )}
              {!active.ordered_at ? (
                <ActionButton action={revokeApproval.bind(null, active.id)} className="btn btn-ghost btn-sm" confirm="Withdraw this approval? The option goes back to the shortlist.">
                  Withdraw approval
                </ActionButton>
              ) : (
                <ActionButton action={(r) => cancelApproval(active.id, r ?? "")} className="btn btn-ghost btn-sm" prompt="Why is this order cancelled?" promptRequired>
                  Cancel order
                </ActionButton>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <div className="eyebrow">Approved</div>
            <div className="mt-1 font-display text-2xl tabular-nums" data-testid="item-committed"><Money cents={0} /></div>
            <div className="text-[12px] text-muted">Nothing counts until an option is approved</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">Forecast</div>
            <div className="mt-1 font-display text-2xl tabular-nums"><Money cents={line?.forecast} /></div>
            <div className="text-[12px] text-muted">{FORECAST_BASIS_LABEL[line?.forecastBasis ?? "none"]}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">Sourcing</div>
            <div className="mt-1 text-[15px]">{SOURCING_LABEL[item.sourcing]}</div>
            {item.source_decision_label && <div className="text-[12px] text-muted">Workbook: {item.source_decision_label}</div>}
          </div>
        </div>
      )}
      {line?.warnings.map((w) => (
        <div key={w} className="mb-3">
          <Notice tone="warn">{w}</Notice>
        </div>
      ))}

      <SectionTitle>Options</SectionTitle>
      {live.length === 0 ? (
        <EmptyState title="No options yet" action={<Link href={`/add?item=${item.id}`} className="btn btn-primary">Add a screenshot or link</Link>}>
          Save screenshots from Taobao, Xiaohongshu or a showroom, or paste a link.
        </EmptyState>
      ) : (
        <div className="snap-row no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {live.map((o) => (
            <div key={o.id} className="w-[78%] shrink-0 sm:w-auto">
              <OptionCard o={o} />
            </div>
          ))}
        </div>
      )}
      {cancelled.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[14px] text-muted">{cancelled.length} cancelled / replaced option{cancelled.length === 1 ? "" : "s"}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {cancelled.map((o) => (
              <OptionCard key={o.id} o={o} />
            ))}
          </div>
        </details>
      )}

      {(locations ?? []).length > 0 && (
        <>
          <SectionTitle>Where to look on the trip</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {(locations ?? []).map((l) => {
              const loc = l.shopping_locations as unknown as { id: string; name_en: string; name_zh: string | null };
              return (
                <Link key={loc.id} href={`/trip/${loc.id}`} className="chip px-3 py-1.5 text-[13px]">
                  <MapPin className="h-3.5 w-3.5" /> {loc.name_en}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {(approvals.length > 0 || payments.length > 0) && (
        <>
          <SectionTitle>History</SectionTitle>
          <ul className="card divide-y hairline text-[14px]">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span>
                  <span className="font-medium">{optionTitle.get(a.option_id)}</span> — {a.status === "active" ? (a.ordered_at ? "approved, ordered" : "approved") : a.status}
                  {a.end_reason && <span className="text-muted"> ({a.end_reason})</span>}
                  {a.order_override_note && <span className="text-muted"> · Override: {a.order_override_note}</span>}
                </span>
                <span className="tabular-nums text-muted">
                  {formatMoney(Math.round(Number(a.cost_sgd) * 100))} · {new Date(a.approved_at).toLocaleDateString("en-SG")}
                </span>
              </li>
            ))}
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 px-4 py-3">
                <span>
                  {p.kind === "refund" ? "Refund" : `Payment (${p.kind})`} {p.reference && <span className="text-muted">· {p.reference}</span>}
                </span>
                <span className="tabular-nums text-muted">
                  {p.kind === "refund" ? "−" : ""}
                  {formatMoney(Math.round(Number(p.amount_sgd) * 100))} · {p.paid_on}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Item details</SectionTitle>
      <div className="card p-5">
        <ActionForm action={updateItem.bind(null, item.id)} submitLabel="Save details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={item.name} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="sourcing">Where to buy</label>
              <select id="sourcing" name="sourcing" defaultValue={item.sourcing} className="field">
                {Object.entries(SOURCING_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              {suggestion && item.sourcing !== suggestion.pref && (
                <p className="mt-1 text-[12px] text-muted">Suggestion: {SOURCING_LABEL[suggestion.pref]} — {suggestion.reason}.</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="budget_category_id">Budget category</label>
              <select id="budget_category_id" name="budget_category_id" defaultValue={item.budget_category_id ?? ""} className="field">
                <option value="">—</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="quantity">Quantity</label>
                <input id="quantity" name="quantity" type="number" step="any" min="0.001" defaultValue={Number(item.quantity)} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="unit">Unit</label>
                <input id="unit" name="unit" defaultValue={item.unit ?? ""} className="field" />
              </div>
            </div>
            {can(member, "budget") ? (
              <div>
                <label className="label" htmlFor="estimate_unit">Allowance per unit (S$, optional)</label>
                <input id="estimate_unit" name="estimate_unit" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={item.estimate_unit ?? ""} className="field" />
              </div>
            ) : (
              <div>
                <div className="label">Allowance per unit</div>
                <div className="py-2 text-[15px]">{item.estimate_unit !== null ? formatMoney(Math.round(Number(item.estimate_unit) * 100)) : "Not set"}</div>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label" htmlFor="dimensions_finish">Dimensions / finish</label>
              <input id="dimensions_finish" name="dimensions_finish" defaultValue={item.dimensions_finish ?? ""} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={item.notes ?? ""} className="field" />
            </div>
            {item.legacy_id && (
              <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
                <input type="checkbox" name="needs_review" defaultChecked={item.needs_review} className="h-4 w-4 accent-graphite" /> Needs review
              </label>
            )}
          </div>
        </ActionForm>
        {item.legacy_id && (
          <dl className="mt-6 grid gap-x-6 gap-y-2 border-t hairline pt-4 text-[13px] text-muted sm:grid-cols-2">
            <div>Workbook ID: {item.legacy_id}</div>
            <div>Workbook category: {item.workbook_category ?? "—"}</div>
            <div>Workbook priority: {item.priority_label ?? "—"}</div>
            <div>Workbook status: {item.legacy_status ?? "—"}</div>
            {item.reference_url && (
              <div className="truncate sm:col-span-2">
                Reference: <a className="underline" href={item.reference_url} target="_blank" rel="noreferrer noopener">{item.reference_url}</a>
              </div>
            )}
          </dl>
        )}
        <div className="mt-4">
          <ActionButton action={archiveItem.bind(null, item.id, !item.is_archived)} className="btn btn-ghost btn-sm" confirm={item.is_archived ? undefined : "Archive this item? It will no longer count in the forecast."}>
            {item.is_archived ? "Restore item" : "Archive item (not needed / duplicate)"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
