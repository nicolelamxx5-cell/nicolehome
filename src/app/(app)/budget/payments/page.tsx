import Link from "next/link";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { PageHeader, EmptyState, Money } from "@/components/ui";
import { ActionButton } from "@/components/action";
import { deletePayment } from "@/app/actions";
import { formatMoney, toCents } from "@/lib/money";
import { PAYMENT_KIND_LABEL } from "@/lib/labels";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const ctx = await getContext();
  const data = await loadBudget(ctx);
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const approvalStatus = new Map(data.approvals.map((a) => [a.id, a.status]));
  const sharedName = new Map(data.shared.map((s) => [s.id, s.name]));
  const mayEdit = can(ctx.member, "payments");
  return (
    <div>
      <PageHeader back={{ href: "/budget", label: "Budget" }} eyebrow="Budget" title="Payments" subtitle={<>Total paid <Money cents={data.summary.actualPaid} /> (refunds subtracted)</>}>
        {mayEdit && <Link href="/budget/payments/new" className="btn btn-primary btn-sm">Record payment</Link>}
      </PageHeader>
      {data.payments.length === 0 ? (
        <EmptyState title="No payments yet">Approving an option is not a payment. Record deposits and balances here when you actually pay.</EmptyState>
      ) : (
        <ul className="card divide-y hairline text-[14px]">
          {data.payments.map((p) => {
            const st = p.approval_id ? approvalStatus.get(p.approval_id) : null;
            const signed = (p.kind === "refund" ? -1 : 1) * (toCents(p.amount_sgd) ?? 0);
            return (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" data-testid="payment-row">
                <div className="min-w-0">
                  <div className="font-medium">
                    {p.required_item_id ? (
                      <Link className="hover:underline" href={`/items/${p.required_item_id}`}>{itemName.get(p.required_item_id)}</Link>
                    ) : p.shared_cost_id ? (
                      sharedName.get(p.shared_cost_id)
                    ) : (
                      "Not linked"
                    )}
                  </div>
                  <div className="text-[12px] text-muted">
                    {PAYMENT_KIND_LABEL[p.kind]} · {p.paid_on}
                    {p.method && ` · ${p.method}`}
                    {p.reference && ` · ${p.reference}`}
                    {st && st !== "active" && ` · for a ${st} choice`}
                    {p.needs_reconciliation && " · needs reconciliation"}
                  </div>
                  {p.notes && <div className="mt-1 text-[12px] text-muted">{p.notes}</div>}
                </div>
                <div className="text-right tabular-nums">
                  <div className={signed < 0 ? "text-sage" : ""}>{formatMoney(signed)}</div>
                  {p.currency !== "SGD" && (
                    <div className="text-[12px] text-muted">
                      {formatMoney(toCents(p.amount), p.currency)} @ {Number(p.fx_rate)} ({p.fx_source})
                    </div>
                  )}
                  {mayEdit && (
                    <ActionButton action={deletePayment.bind(null, p.id)} className="mt-1 text-[12px] text-muted underline-offset-4 hover:underline" confirm="Delete this payment record?">
                      Delete
                    </ActionButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
