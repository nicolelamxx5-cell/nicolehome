import { describe, expect, it } from "vitest";
import {
  landedCost,
  latestRates,
  summarizeBudget,
  groupLines,
  type ApprovalInput,
  type BudgetInput,
  type OptionInput,
  type PaymentInput,
} from "@/lib/finance";
import { allocateCents, convertCents, toCents } from "@/lib/money";

const ROOM = "room-living";
const SOFA = "item-sofa";

function base(): BudgetInput {
  return {
    household: { total_budget: "80000.00", contingency: "0" },
    items: [{ id: SOFA, room_id: ROOM, name: "Main sofa", quantity: "1", estimate_unit: null, sourcing: "china" }],
    options: [
      { id: "opt-cassa", required_item_id: SOFA, status: "shortlisted", price: "550.00", currency: "SGD", quantity: "1" },
      { id: "opt-globus", required_item_id: SOFA, status: "shortlisted", price: "1462.00", currency: null, quantity: "1" },
    ],
    approvals: [],
    payments: [],
    rates: [],
  };
}

const approval = (o: Partial<ApprovalInput> & Pick<ApprovalInput, "id" | "option_id" | "cost_sgd">): ApprovalInput => ({
  required_item_id: SOFA,
  status: "active",
  ...o,
});
const payment = (o: Partial<PaymentInput> & Pick<PaymentInput, "id" | "amount_sgd">): PaymentInput => ({
  kind: "deposit",
  approval_id: null,
  required_item_id: SOFA,
  ...o,
});

describe("money helpers", () => {
  it("parses decimals exactly", () => {
    expect(toCents("1462.00")).toBe(146200);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("1.005")).toBe(101); // half-up, like Postgres
    expect(toCents(null)).toBeNull();
  });

  it("converts with Postgres-compatible rounding", () => {
    // 1462 CNY at 0.18123456 = 264.96491... → 264.96
    expect(convertCents(146200, "0.18123456")).toBe(26496);
    // qty and extra charges: (99.99 × 3 + 10) × 0.1875 = 58.119375 → 58.12
    expect(convertCents(9999, "0.1875", "3", 1000)).toBe(5812);
  });

  it("allocates shared costs so parts always sum to the total", () => {
    const parts = allocateCents(100000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100000);
    expect(parts).toEqual([33334, 33333, 33333]);
    expect(allocateCents(999, [0, 0])).toEqual([500, 499]);
    expect(allocateCents(1000, [300, 100])).toEqual([750, 250]);
  });
});

describe("two options for one required item", () => {
  it("shortlisted options never count as commitments", () => {
    const s = summarizeBudget(base());
    expect(s.approvedCommitments).toBe(0);
    expect(s.actualPaid).toBe(0);
    expect(s.outstanding).toBe(0);
    expect(s.committedExposure).toBe(0);
    // Forecast falls back to the highest shortlisted option with a known currency.
    expect(s.items[0].forecastBasis).toBe("highest_shortlisted");
    expect(s.forecastFinalCost).toBe(55000);
    // The Globus price has no confirmed currency, so it is excluded and flagged.
    expect(s.items[0].warnings.join(" ")).toMatch(/unconfirmed currency/);
  });

  it("unapproved wishlist options are ignored by forecast and commitments", () => {
    const input = base();
    input.options = [{ id: "w", required_item_id: SOFA, status: "wishlist", price: "9999", currency: "SGD", quantity: "1" }];
    const s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(0);
    expect(s.forecastFinalCost).toBe(0);
    expect(s.itemsWithoutEstimate).toBe(1);
  });

  it("an allowance from the workbook takes precedence over option prices for forecast", () => {
    const input = base();
    input.items[0].estimate_unit = "2500";
    const s = summarizeBudget(input);
    expect(s.items[0].forecastBasis).toBe("allowance");
    expect(s.forecastFinalCost).toBe(250000);
  });
});

describe("approval, deposits and replacement", () => {
  it("only the approved option contributes", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00" })];
    const s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(55000);
    expect(s.forecastFinalCost).toBe(55000);
    expect(s.remainingVsCommitted).toBe(8000000 - 55000);
  });

  it("deposit plus balance payment", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00" })];
    input.payments = [payment({ id: "p1", amount_sgd: "200.00", approval_id: "a1" })];
    let s = summarizeBudget(input);
    expect(s.actualPaid).toBe(20000);
    expect(s.outstanding).toBe(35000);
    expect(s.approvedCommitments).toBe(55000); // paying does not add to commitments
    expect(s.committedExposure).toBe(55000);

    input.payments.push(payment({ id: "p2", kind: "balance", amount_sgd: "350.00", approval_id: "a1" }));
    s = summarizeBudget(input);
    expect(s.actualPaid).toBe(55000);
    expect(s.outstanding).toBe(0);
    expect(s.committedExposure).toBe(55000); // never commitments + payments
    expect(s.forecastFinalCost).toBe(55000);
  });

  it("replacing an approved option replaces the commitment (no double counting)", () => {
    const input = base();
    input.approvals = [
      approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00", status: "superseded" }),
      approval({ id: "a2", option_id: "opt-globus", cost_sgd: "1462.00" }),
    ];
    const s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(146200);
    expect(s.forecastFinalCost).toBe(146200);
  });

  it("a deposit paid on a replaced choice stays visible but is not added to the new commitment", () => {
    const input = base();
    input.approvals = [
      approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00", status: "superseded" }),
      approval({ id: "a2", option_id: "opt-globus", cost_sgd: "1462.00" }),
    ];
    input.payments = [payment({ id: "p1", amount_sgd: "100.00", approval_id: "a1" })];
    const s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(146200);
    expect(s.actualPaid).toBe(10000);
    expect(s.replacedSpend).toBe(10000);
    expect(s.outstanding).toBe(146200); // the old deposit does not pay the new supplier
    expect(s.committedExposure).toBe(156200);
    expect(s.forecastFinalCost).toBe(156200);
  });

  it("an overpayment is reported, and exposure uses the larger figure", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00" })];
    input.payments = [payment({ id: "p1", kind: "full", amount_sgd: "600.00", approval_id: "a1" })];
    const s = summarizeBudget(input);
    expect(s.items[0].overpaid).toBe(5000);
    expect(s.outstanding).toBe(0);
    expect(s.committedExposure).toBe(60000);
  });
});

describe("refunds and cancellations", () => {
  it("refunds reduce actual paid", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00" })];
    input.payments = [
      payment({ id: "p1", kind: "full", amount_sgd: "550.00", approval_id: "a1" }),
      payment({ id: "p2", kind: "refund", amount_sgd: "50.00", approval_id: "a1" }),
    ];
    const s = summarizeBudget(input);
    expect(s.actualPaid).toBe(50000);
    expect(s.outstanding).toBe(5000);
  });

  it("a cancelled order drops the commitment but keeps unrefunded deposits", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00", status: "cancelled" })];
    input.payments = [payment({ id: "p1", amount_sgd: "200.00", approval_id: "a1" })];
    let s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(0);
    expect(s.outstanding).toBe(0);
    expect(s.replacedSpend).toBe(20000);
    expect(s.committedExposure).toBe(20000);

    input.payments.push(payment({ id: "p2", kind: "refund", amount_sgd: "200.00", approval_id: "a1" }));
    s = summarizeBudget(input);
    expect(s.actualPaid).toBe(0);
    expect(s.committedExposure).toBe(0);
  });
});

describe("currency conversion", () => {
  const cny: OptionInput = {
    id: "o", required_item_id: SOFA, status: "shortlisted", price: "8000", currency: "CNY", quantity: "2",
    other_charges: "300", freight_allowance: "150", freight_currency: "SGD",
  };

  it("needs a rate and uses the latest one by date", () => {
    expect(landedCost(cny, latestRates([]))).toEqual({ ok: false, reason: "no_rate", currency: "CNY" });
    const rates = latestRates([
      { currency: "CNY", rate_to_sgd: "0.18000000", as_of: "2026-10-01", source: "ECB" },
      { currency: "CNY", rate_to_sgd: "0.18500000", as_of: "2026-11-01", source: "Manual" },
    ]);
    const c = landedCost(cny, rates);
    expect(c.ok && c.goods).toBe(301550); // (8000 × 2 + 300) × 0.185 = 3015.50
    expect(c.ok && c.freight).toBe(15000);
    expect(c.ok && c.total).toBe(316550);
  });

  it("an approved snapshot does not move when rates change", () => {
    const input = base();
    input.approvals = [approval({ id: "a1", option_id: "opt-globus", cost_sgd: "263.16" })];
    input.rates = [{ currency: "CNY", rate_to_sgd: "0.25", as_of: "2026-12-01", source: "Manual" }];
    expect(summarizeBudget(input).approvedCommitments).toBe(26316);
  });

  it("an unknown currency is never assumed to be SGD", () => {
    const c = landedCost({ ...cny, currency: null }, latestRates([]));
    expect(c).toEqual({ ok: false, reason: "currency_unknown" });
  });
});

describe("shared freight allocation", () => {
  it("counts the container once and allocates it to approved China items", () => {
    const input = base();
    input.items.push(
      { id: "tiles", room_id: "room-whole", name: "Floor tiles", quantity: "1", estimate_unit: null, sourcing: "china" },
      { id: "oven", room_id: "room-kitchen", name: "Oven", quantity: "1", estimate_unit: null, sourcing: "singapore" },
    );
    input.approvals = [
      approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "1000.00" }),
      { id: "a2", required_item_id: "tiles", option_id: "t", status: "active", cost_sgd: "3000.00" },
      { id: "a3", required_item_id: "oven", option_id: "ov", status: "active", cost_sgd: "4189.00" },
    ];
    input.sharedCosts = [
      { id: "c1", name: "China container", amount_sgd: "2000.00", status: "committed", allocation: "by_value", applies_to: "china" },
    ];
    input.payments = [{ id: "p", kind: "deposit", amount_sgd: "500.00", approval_id: null, required_item_id: null, shared_cost_id: "c1" }];
    const s = summarizeBudget(input);
    expect(s.approvedCommitments).toBe(100000 + 300000 + 418900 + 200000);
    expect(s.actualPaid).toBe(50000);
    expect(s.outstanding).toBe(100000 + 300000 + 418900 + 150000);
    const alloc = s.shared[0].allocation;
    expect(alloc.map((a) => a.itemId)).toEqual([SOFA, "tiles"]);
    expect(alloc.map((a) => a.cents)).toEqual([50000, 150000]);
    const rooms = groupLines(s, (l) => l.roomId);
    const sharedTotal = [...rooms.values()].reduce((a, g) => a + g.shared, 0);
    expect(sharedTotal).toBe(200000);
  });
});

describe("reconciliation", () => {
  it("dashboard totals equal the sum of their item lines", () => {
    const input = base();
    input.items.push({ id: "x", room_id: "r2", name: "Rug", quantity: "2", estimate_unit: "120.50", sourcing: "china" });
    input.approvals = [approval({ id: "a1", option_id: "opt-cassa", cost_sgd: "550.00" })];
    input.payments = [
      payment({ id: "p1", amount_sgd: "100.00", approval_id: "a1" }),
      payment({ id: "p2", kind: "other", amount_sgd: "40.00", required_item_id: "x" }),
    ];
    const s = summarizeBudget(input);
    const sum = (k: "approvedCost" | "paid" | "outstanding" | "forecast" | "committedExposure") =>
      s.items.reduce((a, l) => a + l[k], 0);
    expect(s.approvedCommitments).toBe(sum("approvedCost"));
    expect(s.actualPaid).toBe(sum("paid"));
    expect(s.outstanding).toBe(sum("outstanding"));
    expect(s.forecastFinalCost).toBe(sum("forecast"));
    expect(s.committedExposure).toBe(sum("committedExposure"));
    expect(s.unreconciledPaid).toBe(4000);
    // The rug's unlinked payment is part of its allowance, not on top of it.
    expect(s.items[1].forecast).toBe(24100);
  });
});
