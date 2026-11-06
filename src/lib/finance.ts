// Budget and commitment calculations. Pure functions: the dashboard, room
// pages and tests all use this one implementation, and every total is the sum
// of per-item lines so it can be inspected record by record.

import { allocateCents, convertCents, toCents, type Cents } from "./money";

export type OptionStatus = "wishlist" | "shortlisted" | "pending_confirmation" | "approved" | "ordered" | "cancelled";
export type ApprovalStatus = "active" | "superseded" | "revoked" | "cancelled";
export type PaymentKind = "deposit" | "progress" | "balance" | "full" | "refund" | "other";

export interface RateInput {
  currency: string;
  rate_to_sgd: number | string;
  as_of: string;
  source: string;
  created_at?: string;
}

export interface ItemInput {
  id: string;
  room_id: string;
  budget_category_id?: string | null;
  name: string;
  quantity: number | string;
  estimate_unit: number | string | null; // SGD allowance per unit
  sourcing?: string;
  is_archived?: boolean;
}

export interface OptionInput {
  id: string;
  required_item_id: string;
  status: OptionStatus;
  price: number | string | null;
  currency: string | null;
  quantity: number | string;
  other_charges?: number | string | null;
  freight_allowance?: number | string | null;
  freight_currency?: string | null;
}

export interface ApprovalInput {
  id: string;
  required_item_id: string;
  option_id: string;
  status: ApprovalStatus;
  cost_sgd: number | string;
  ordered_at?: string | null;
}

export interface PaymentInput {
  id: string;
  kind: PaymentKind;
  amount_sgd: number | string;
  approval_id: string | null;
  required_item_id: string | null;
  shared_cost_id?: string | null;
}

export interface SharedCostInput {
  id: string;
  name: string;
  amount_sgd: number | string;
  status: "forecast" | "committed" | "cancelled";
  allocation: "by_value" | "equal";
  applies_to: "china" | "all";
}

export interface HouseholdInput {
  total_budget: number | string | null;
  contingency: number | string | null;
}

// ---------------------------------------------------------------------------
// Rates and landed cost
// ---------------------------------------------------------------------------

export function latestRates(rates: RateInput[]): Map<string, RateInput> {
  const map = new Map<string, RateInput>();
  const sorted = [...rates].sort(
    (a, b) => b.as_of.localeCompare(a.as_of) || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
  for (const r of sorted) if (!map.has(r.currency)) map.set(r.currency, r);
  return map;
}

export function rateFor(currency: string, rates: Map<string, RateInput>): RateInput | null {
  if (currency === "SGD") return { currency: "SGD", rate_to_sgd: 1, as_of: "", source: "Base currency" };
  return rates.get(currency) ?? null;
}

export type LandedCost =
  | { ok: true; goods: Cents; freight: Cents; total: Cents; rate: RateInput }
  | { ok: false; reason: "no_price" | "currency_unknown" | "no_rate" | "freight_currency_unknown"; currency?: string };

/** Estimated landed cost in SGD for an option — same formula as approve_option(). */
export function landedCost(o: OptionInput, rates: Map<string, RateInput>): LandedCost {
  const price = toCents(o.price);
  if (price === null) return { ok: false, reason: "no_price" };
  if (!o.currency) return { ok: false, reason: "currency_unknown" };
  const r = rateFor(o.currency, rates);
  if (!r) return { ok: false, reason: "no_rate", currency: o.currency };
  const goods = convertCents(price, r.rate_to_sgd, o.quantity, toCents(o.other_charges) ?? 0);
  const freightAmount = toCents(o.freight_allowance) ?? 0;
  let freight = 0;
  if (freightAmount > 0) {
    if (!o.freight_currency) return { ok: false, reason: "freight_currency_unknown" };
    const fr = rateFor(o.freight_currency, rates);
    if (!fr) return { ok: false, reason: "no_rate", currency: o.freight_currency };
    freight = convertCents(freightAmount, fr.rate_to_sgd);
  }
  return { ok: true, goods, freight, total: goods + freight, rate: r };
}

export function signedPaymentCents(p: Pick<PaymentInput, "kind" | "amount_sgd">): Cents {
  const c = toCents(p.amount_sgd) ?? 0;
  return p.kind === "refund" ? -c : c;
}

// ---------------------------------------------------------------------------
// Per-item lines
// ---------------------------------------------------------------------------

export type ForecastBasis = "approved" | "allowance" | "highest_shortlisted" | "payments_only" | "none";

export interface ItemLine {
  itemId: string;
  roomId: string;
  categoryId: string | null;
  activeApprovalId: string | null;
  approvedCost: Cents; // active approval snapshot (0 if none)
  paidOnActive: Cents; // net payments against the active approval
  outstanding: Cents; // max(0, approvedCost − paidOnActive)
  overpaid: Cents; // max(0, paidOnActive − approvedCost)
  replacedSpend: Cents; // net payments on superseded / revoked / cancelled approvals
  unlinkedPaid: Cents; // payments on the item with no approval (flagged for reconciliation)
  paid: Cents; // all net payments for this item
  committedExposure: Cents; // money spent or promised for this item
  allowance: Cents | null; // workbook / owner estimate (qty × unit)
  forecastBasis: ForecastBasis;
  forecast: Cents;
  shortlistedCount: number;
  optionCount: number;
  warnings: string[];
}

export interface SharedLine {
  id: string;
  name: string;
  amount: Cents;
  status: SharedCostInput["status"];
  committed: Cents;
  paid: Cents;
  outstanding: Cents;
  forecast: Cents;
  committedExposure: Cents;
  allocation: { itemId: string; roomId: string; cents: Cents }[];
}

export interface BudgetSummary {
  totalBudget: Cents | null;
  contingency: Cents;
  approvedCommitments: Cents;
  actualPaid: Cents;
  outstanding: Cents;
  replacedSpend: Cents;
  unreconciledPaid: Cents;
  committedExposure: Cents;
  forecastFinalCost: Cents;
  remainingVsCommitted: Cents | null;
  remainingVsForecast: Cents | null;
  itemsWithoutEstimate: number;
  items: ItemLine[];
  shared: SharedLine[];
  unassignedPayments: Cents; // payments linked to neither item nor shared cost
  warnings: string[];
}

export interface BudgetInput {
  household: HouseholdInput;
  items: ItemInput[];
  options: OptionInput[];
  approvals: ApprovalInput[];
  payments: PaymentInput[];
  sharedCosts?: SharedCostInput[];
  rates: RateInput[];
}

const SHORTLIST_STATUSES: OptionStatus[] = ["shortlisted", "pending_confirmation"];

export function summarizeBudget(input: BudgetInput): BudgetSummary {
  const rates = latestRates(input.rates);
  const warnings: string[] = [];
  const items = input.items.filter((i) => !i.is_archived);
  const itemIds = new Set(items.map((i) => i.id));

  const approvalsById = new Map(input.approvals.map((a) => [a.id, a]));
  const activeByItem = new Map<string, ApprovalInput>();
  for (const a of input.approvals) {
    if (a.status !== "active") continue;
    if (activeByItem.has(a.required_item_id)) {
      // The database prevents this; if it ever happens, count once and shout.
      warnings.push(`Item ${a.required_item_id} has more than one active approval — only the first is counted.`);
      continue;
    }
    activeByItem.set(a.required_item_id, a);
  }

  const optionsByItem = new Map<string, OptionInput[]>();
  for (const o of input.options) {
    const list = optionsByItem.get(o.required_item_id) ?? [];
    list.push(o);
    optionsByItem.set(o.required_item_id, list);
  }

  // Bucket payments
  const paidByApproval = new Map<string, Cents>();
  const unlinkedByItem = new Map<string, Cents>();
  const paidByShared = new Map<string, Cents>();
  let unassignedPayments = 0;
  let actualPaid = 0;
  for (const p of input.payments) {
    const c = signedPaymentCents(p);
    actualPaid += c;
    if (p.approval_id && approvalsById.has(p.approval_id)) {
      paidByApproval.set(p.approval_id, (paidByApproval.get(p.approval_id) ?? 0) + c);
    } else if (p.shared_cost_id) {
      paidByShared.set(p.shared_cost_id, (paidByShared.get(p.shared_cost_id) ?? 0) + c);
    } else if (p.required_item_id && itemIds.has(p.required_item_id)) {
      unlinkedByItem.set(p.required_item_id, (unlinkedByItem.get(p.required_item_id) ?? 0) + c);
    } else {
      unassignedPayments += c;
    }
  }

  const lines: ItemLine[] = items.map((item) => {
    const w: string[] = [];
    const active = activeByItem.get(item.id) ?? null;
    const approvedCost = active ? (toCents(active.cost_sgd) ?? 0) : 0;
    const paidOnActive = active ? (paidByApproval.get(active.id) ?? 0) : 0;
    let replacedSpend = 0;
    for (const a of input.approvals) {
      if (a.required_item_id === item.id && a.status !== "active") replacedSpend += paidByApproval.get(a.id) ?? 0;
    }
    if (replacedSpend < 0) w.push("Refunds exceed payments on replaced choices — check the payment records.");
    const unlinkedPaid = unlinkedByItem.get(item.id) ?? 0;
    if (unlinkedPaid !== 0) w.push("Payment recorded without an approved option — needs reconciliation.");

    const unit = toCents(item.estimate_unit);
    const allowance = unit === null ? null : convertCents(unit, 1, item.quantity);
    const opts = optionsByItem.get(item.id) ?? [];
    const shortlisted = opts.filter((o) => SHORTLIST_STATUSES.includes(o.status));

    const committedPart = active ? Math.max(approvedCost, paidOnActive) : 0;
    const committedExposure = committedPart + replacedSpend + unlinkedPaid;

    let forecastBasis: ForecastBasis = "none";
    let base = 0;
    if (active) {
      forecastBasis = "approved";
    } else if (allowance !== null) {
      forecastBasis = "allowance";
      base = allowance;
    } else {
      const costs = shortlisted.map((o) => landedCost(o, rates)).filter((c) => c.ok);
      if (costs.length > 0) {
        forecastBasis = "highest_shortlisted";
        base = Math.max(...costs.map((c) => (c.ok ? c.total : 0)));
      }
      const unknown = shortlisted.filter((o) => {
        const c = landedCost(o, rates);
        return !c.ok && c.reason !== "no_price";
      });
      if (unknown.length > 0) w.push(`${unknown.length} shortlisted option(s) have an unconfirmed currency or missing exchange rate and are not in the forecast.`);
    }
    if (!active && forecastBasis === "none" && unlinkedPaid > 0) forecastBasis = "payments_only";
    const forecast = active ? committedExposure : Math.max(base, unlinkedPaid) + replacedSpend;

    return {
      itemId: item.id,
      roomId: item.room_id,
      categoryId: item.budget_category_id ?? null,
      activeApprovalId: active?.id ?? null,
      approvedCost,
      paidOnActive,
      outstanding: Math.max(0, approvedCost - paidOnActive),
      overpaid: Math.max(0, paidOnActive - approvedCost),
      replacedSpend,
      unlinkedPaid,
      paid: paidOnActive + replacedSpend + unlinkedPaid,
      committedExposure,
      allowance,
      forecastBasis,
      forecast,
      shortlistedCount: shortlisted.length,
      optionCount: opts.length,
      warnings: w,
    };
  });

  // Approvals or payments pointing at archived/missing items still count.
  for (const a of input.approvals) {
    if (a.status === "active" && !itemIds.has(a.required_item_id)) {
      warnings.push("An active approval belongs to an archived item; it is still counted in totals.");
    }
  }
  let orphanCommitted = 0;
  for (const a of input.approvals) {
    if (itemIds.has(a.required_item_id)) continue;
    const paid = paidByApproval.get(a.id) ?? 0;
    orphanCommitted += a.status === "active" ? Math.max(toCents(a.cost_sgd) ?? 0, paid) : paid;
  }
  for (const [itemId, c] of unlinkedByItem) if (!itemIds.has(itemId)) orphanCommitted += c;

  // Shared costs (e.g. the China container). Counted once at household level,
  // allocated to items only for display.
  const eligibleChina = lines.filter((l) => l.activeApprovalId && items.find((i) => i.id === l.itemId)?.sourcing === "china");
  const eligibleAll = lines.filter((l) => l.activeApprovalId);
  const shared: SharedLine[] = (input.sharedCosts ?? []).map((s) => {
    const amount = toCents(s.amount_sgd) ?? 0;
    const paid = paidByShared.get(s.id) ?? 0;
    const committed = s.status === "committed" ? amount : 0;
    const exposure = s.status === "committed" ? Math.max(amount, paid) : paid;
    const forecast = s.status === "cancelled" ? paid : Math.max(amount, paid);
    const targets = s.applies_to === "china" ? eligibleChina : eligibleAll;
    const parts = allocateCents(
      forecast,
      targets.map((t) => (s.allocation === "equal" ? 1 : t.approvedCost)),
    );
    return {
      id: s.id,
      name: s.name,
      amount,
      status: s.status,
      committed,
      paid,
      outstanding: Math.max(0, committed - paid),
      forecast,
      committedExposure: exposure,
      allocation: targets.map((t, i) => ({ itemId: t.itemId, roomId: t.roomId, cents: parts[i] })),
    };
  });

  const sum = (f: (l: ItemLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  const sumShared = (f: (l: SharedLine) => number) => shared.reduce((a, l) => a + f(l), 0);

  let orphanApproved = 0;
  let orphanOutstanding = 0;
  for (const a of input.approvals) {
    if (a.status !== "active" || itemIds.has(a.required_item_id)) continue;
    const cost = toCents(a.cost_sgd) ?? 0;
    orphanApproved += cost;
    orphanOutstanding += Math.max(0, cost - (paidByApproval.get(a.id) ?? 0));
  }

  const contingency = toCents(input.household.contingency) ?? 0;
  const totalBudget = toCents(input.household.total_budget);
  const approvedCommitments = sum((l) => l.approvedCost) + sumShared((s) => s.committed) + orphanApproved;
  const committedExposure = sum((l) => l.committedExposure) + sumShared((s) => s.committedExposure) + orphanCommitted + unassignedPayments;
  const forecastFinalCost = sum((l) => l.forecast) + sumShared((s) => s.forecast) + orphanCommitted + unassignedPayments + contingency;
  if (unassignedPayments !== 0) warnings.push("Some payments are not linked to an item or shared cost.");

  return {
    totalBudget,
    contingency,
    approvedCommitments,
    actualPaid,
    outstanding: sum((l) => l.outstanding) + sumShared((s) => s.outstanding) + orphanOutstanding,
    replacedSpend: sum((l) => l.replacedSpend),
    unreconciledPaid: sum((l) => l.unlinkedPaid) + unassignedPayments,
    committedExposure,
    forecastFinalCost,
    remainingVsCommitted: totalBudget === null ? null : totalBudget - committedExposure,
    remainingVsForecast: totalBudget === null ? null : totalBudget - forecastFinalCost,
    itemsWithoutEstimate: lines.filter((l) => l.forecastBasis === "none").length,
    items: lines,
    shared,
    unassignedPayments,
    warnings,
  };
}

/** Group item lines (plus shared-cost allocations) by a key, e.g. room. */
export function groupLines(summary: BudgetSummary, key: (l: ItemLine) => string | null) {
  const groups = new Map<string, { approved: Cents; paid: Cents; outstanding: Cents; forecast: Cents; exposure: Cents; shared: Cents; count: number }>();
  const get = (k: string) => {
    let g = groups.get(k);
    if (!g) {
      g = { approved: 0, paid: 0, outstanding: 0, forecast: 0, exposure: 0, shared: 0, count: 0 };
      groups.set(k, g);
    }
    return g;
  };
  for (const l of summary.items) {
    const g = get(key(l) ?? "none");
    g.approved += l.approvedCost;
    g.paid += l.paid;
    g.outstanding += l.outstanding;
    g.forecast += l.forecast;
    g.exposure += l.committedExposure;
    g.count += 1;
  }
  const byItem = new Map(summary.items.map((l) => [l.itemId, l]));
  for (const s of summary.shared) {
    for (const a of s.allocation) {
      const line = byItem.get(a.itemId);
      if (line) get(key(line) ?? "none").shared += a.cents;
    }
  }
  return groups;
}

export const FORECAST_BASIS_LABEL: Record<ForecastBasis, string> = {
  approved: "Approved choice",
  allowance: "Your allowance",
  highest_shortlisted: "Highest shortlisted option",
  payments_only: "Payments recorded",
  none: "No estimate yet",
};
