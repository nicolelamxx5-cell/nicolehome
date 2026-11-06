// Decides what an import will do, without touching the database. Re-importing
// the same workbook is a no-op; rows edited in the app are never silently
// overwritten (they are reported as conflicts instead).

import type { ImportIssue, ParsedItemRow, ParsedPayment, ParsedRoom, ParsedWorkbook } from "./parse";
import { convertCents, toCents, toScaled } from "../money";

export type Sourcing = "china" | "singapore" | "compare" | "undecided";

export interface ItemFields {
  name: string;
  specification: string;
  workbook_category: string | null;
  priority_label: string | null;
  source_decision_label: string | null;
  sourcing: Sourcing;
  quantity: number;
  unit: string | null;
  estimate_unit: number | null;
  legacy_status: string | null;
  purchase_by: string | null;
  reference_url: string | null;
  photo_link: string | null;
  dimensions_finish: string | null;
  notes: string | null;
}

export const ITEM_FIELD_KEYS: (keyof ItemFields)[] = [
  "name", "specification", "workbook_category", "priority_label", "source_decision_label", "sourcing",
  "quantity", "unit", "estimate_unit", "legacy_status", "purchase_by", "reference_url", "photo_link",
  "dimensions_finish", "notes",
];

export interface ExistingItem extends Partial<ItemFields> {
  id: string;
  legacy_id: string | null;
  room_id: string;
  needs_review?: boolean;
  review_note?: string | null;
  import_snapshot: Partial<ItemFields> | null;
}

export interface ExistingState {
  rooms: { id: string; name: string }[];
  items: ExistingItem[];
  optionImportKeys: string[];
  paymentImportKeys: string[];
}

export interface OptionCreate {
  legacyId: string;
  import_key: string;
  title: string;
  supplier_name: string | null;
  model_sku: string | null;
  url: string | null;
  platform: string;
  price: number | null;
  currency: string | null;
  price_basis: "estimate" | "quoted";
  quantity: number;
  status: "shortlisted";
  notes: string;
  commitmentSgd: number | null; // workbook "Ordered Unit" × Qty → imported commitment
}

export interface PaymentCreate {
  import_key: string;
  legacyId: string | null;
  kind: "deposit" | "progress" | "balance" | "full" | "refund" | "other";
  amount: number;
  currency: string;
  fx_rate: number;
  amount_sgd: number;
  paid_on: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  supplierName: string | null;
}

export interface FieldConflict {
  legacyId: string;
  field: keyof ItemFields;
  appValue: unknown;
  workbookValue: unknown;
}

export interface ImportPlan {
  roomsToCreate: ParsedRoom[];
  itemsToCreate: (ItemFields & { legacy_id: string; roomName: string; needs_review: boolean; review_note: string | null })[];
  itemsToUpdate: { id: string; legacyId: string; changes: Partial<ItemFields>; snapshot: ItemFields; review?: { needs_review: boolean; review_note: string } }[];
  unchangedItems: number;
  conflicts: FieldConflict[];
  optionsToCreate: OptionCreate[];
  paymentsToCreate: PaymentCreate[];
  guidelines: ParsedWorkbook["guidelines"];
  issues: ImportIssue[];
  summary: Record<string, number>;
}

export function deriveSourcing(label: string | null): Sourcing {
  if (!label) return "undecided";
  const l = label.toLowerCase();
  if (l.includes("compare")) return "compare";
  if (l.includes("china")) return "china"; // "China - ARCFORM", "China + SG installer"
  if (l.includes("singapore") || /\bsg\b/.test(l) || l.includes("metro")) return "singapore";
  return "undecided";
}

export function detectPlatform(url: string | null): string {
  if (!url) return "other";
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (/taobao|tmall/.test(host)) return "taobao";
  if (/pinduoduo|yangkeduo|pdd/.test(host)) return "pinduoduo";
  if (/1688\.com/.test(host)) return "1688";
  if (/xiaohongshu|xhslink/.test(host)) return "xiaohongshu";
  if (/\.sg$/.test(host) || /gaincity|courts|harveynorman|bestdenki|sharkninja/.test(host) || /ikea\.com$/.test(host) && url.includes("/sg/")) return "singapore_store";
  return "website";
}

export function rowToFields(r: ParsedItemRow): ItemFields {
  return {
    name: r.specification.slice(0, 200),
    specification: r.specification,
    workbook_category: r.category,
    priority_label: r.priority,
    source_decision_label: r.sourceDecision,
    sourcing: deriveSourcing(r.sourceDecision),
    quantity: r.quantity && r.quantity > 0 ? r.quantity : 1,
    unit: r.unit,
    estimate_unit: r.estimateUnit,
    legacy_status: r.status,
    purchase_by: r.purchaseBy,
    reference_url: r.referenceUrl,
    photo_link: r.photoLink,
    dimensions_finish: r.dimensions,
    notes: r.notes,
  };
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined || v === "" ? null : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
  return norm(a) === norm(b);
}

const PAYMENT_KINDS: Record<string, PaymentCreate["kind"]> = {
  deposit: "deposit",
  progress: "progress",
  balance: "balance",
  "full payment": "full",
  full: "full",
  refund: "refund",
  other: "other",
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function planImport(parsed: ParsedWorkbook, existing: ExistingState, today: string): ImportPlan {
  const issues: ImportIssue[] = [...parsed.issues];
  const roomNames = new Set(existing.rooms.map((r) => r.name.toLowerCase()));
  const roomsToCreate = parsed.rooms.filter((r) => !roomNames.has(r.name.toLowerCase()));
  const byLegacy = new Map(existing.items.filter((i) => i.legacy_id).map((i) => [i.legacy_id!, i]));

  // Review notes per ID (overlaps, typed totals, odd statuses)
  const reviewNotes = new Map<string, string[]>();
  for (const i of parsed.issues) {
    if (i.severity === "info") continue;
    for (const id of i.relatedIds ?? (i.legacyId ? [i.legacyId] : [])) {
      reviewNotes.set(id, [...(reviewNotes.get(id) ?? []), i.message]);
    }
  }

  const plan: ImportPlan = {
    roomsToCreate,
    itemsToCreate: [],
    itemsToUpdate: [],
    unchangedItems: 0,
    conflicts: [],
    optionsToCreate: [],
    paymentsToCreate: [],
    guidelines: parsed.guidelines,
    issues,
    summary: {},
  };

  for (const row of parsed.items) {
    const fields = rowToFields(row);
    const notes = reviewNotes.get(row.legacyId);
    const current = byLegacy.get(row.legacyId);
    if (!current) {
      plan.itemsToCreate.push({
        ...fields,
        legacy_id: row.legacyId,
        roomName: row.roomName,
        needs_review: !!notes,
        review_note: notes ? notes.join("\n") : null,
      });
    } else {
      const changes: Partial<ItemFields> = {};
      const snap = current.import_snapshot ?? null;
      for (const k of ITEM_FIELD_KEYS) {
        const wb = fields[k];
        const app = current[k];
        if (same(wb, app)) continue;
        const prev = snap ? snap[k] : undefined;
        if (snap && same(app, prev)) {
          (changes as Record<string, unknown>)[k] = wb; // workbook changed; app untouched
        } else if (snap && same(wb, prev)) {
          // app changed; workbook unchanged → keep the app's value silently
        } else {
          plan.conflicts.push({ legacyId: row.legacyId, field: k, appValue: app ?? null, workbookValue: wb });
        }
      }
      const review =
        notes && !current.needs_review && !current.review_note
          ? { needs_review: true, review_note: notes.join("\n") }
          : undefined;
      if (Object.keys(changes).length > 0 || review || !snap) {
        plan.itemsToUpdate.push({ id: current.id, legacyId: row.legacyId, changes, snapshot: fields, review });
      } else {
        plan.unchangedItems++;
      }
    }

    // Candidate product already named in the workbook
    const optionKey = `wb:${row.legacyId}`;
    const hasCandidate = row.supplier || row.model || row.referenceUrl || row.quotedUnit !== null || row.orderedUnit !== null;
    if (hasCandidate && !existing.optionImportKeys.includes(optionKey)) {
      const price = row.orderedUnit ?? row.quotedUnit ?? row.estimateUnit;
      plan.optionsToCreate.push({
        legacyId: row.legacyId,
        import_key: optionKey,
        title: [row.supplier, row.model].filter(Boolean).join(" ").trim() || row.specification,
        supplier_name: row.supplier,
        model_sku: row.model,
        url: row.referenceUrl && /^https?:\/\//i.test(row.referenceUrl) ? row.referenceUrl : null,
        platform: detectPlatform(row.referenceUrl),
        price,
        currency: price === null ? null : "SGD", // workbook price columns are labelled SGD
        price_basis: row.orderedUnit !== null || row.quotedUnit !== null ? "quoted" : "estimate",
        quantity: fields.quantity,
        status: "shortlisted",
        notes: `Imported from workbook ${row.sheet} row ${row.row}. Price is the workbook ${
          row.orderedUnit !== null ? "ordered" : row.quotedUnit !== null ? "quoted" : "estimated"
        } unit price; verify before ordering.`,
        commitmentSgd: row.orderedUnit !== null ? round2(row.orderedUnit * fields.quantity) : null,
      });
    }
  }

  // Payments tab (individual transactions)
  const occurrences = new Map<string, number>();
  const paymentIdsOnTab = new Set<string>();
  for (const p of parsed.payments) {
    if (p.legacyId) paymentIdsOnTab.add(p.legacyId);
    const created = paymentFromRow(p, today, issues);
    if (!created) continue;
    const baseKey = `wb-pay:${p.date}|${p.legacyId}|${created.amount}|${created.currency}|${p.reference ?? ""}|${created.kind}`;
    const n = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, n);
    created.import_key = `${baseKey}#${n}`;
    if (!existing.paymentImportKeys.includes(created.import_key)) plan.paymentsToCreate.push(created);
  }

  // Cumulative "Paid to Date" only where the Payments tab has nothing for that ID
  for (const row of parsed.items) {
    if (!row.paidToDate || row.paidToDate <= 0 || paymentIdsOnTab.has(row.legacyId)) continue;
    const key = `wb-paid:${row.legacyId}`;
    if (existing.paymentImportKeys.includes(key)) continue;
    plan.paymentsToCreate.push({
      import_key: key,
      legacyId: row.legacyId,
      kind: "other",
      amount: round2(row.paidToDate),
      currency: "SGD",
      fx_rate: 1,
      amount_sgd: round2(row.paidToDate),
      paid_on: today,
      method: null,
      reference: null,
      notes: `Cumulative "Paid to Date" from workbook ${row.sheet} row ${row.row}; actual payment date(s) unknown.`,
      supplierName: row.supplier,
    });
  }

  plan.summary = {
    rooms_created: roomsToCreate.length,
    items_created: plan.itemsToCreate.length,
    items_updated: plan.itemsToUpdate.filter((u) => Object.keys(u.changes).length > 0).length,
    items_unchanged: plan.unchangedItems + plan.itemsToUpdate.filter((u) => Object.keys(u.changes).length === 0).length,
    conflicts: plan.conflicts.length,
    options_created: plan.optionsToCreate.length,
    payments_created: plan.paymentsToCreate.length,
    flagged_for_review: plan.itemsToCreate.filter((i) => i.needs_review).length + plan.itemsToUpdate.filter((u) => u.review).length,
    warnings: issues.filter((i) => i.severity !== "info").length,
  };
  return plan;
}

function paymentFromRow(p: ParsedPayment, today: string, issues: ImportIssue[]): PaymentCreate | null {
  const kind = PAYMENT_KINDS[(p.type ?? "other").toLowerCase()] ?? "other";
  let amount: number;
  let currency = "SGD";
  let fx = 1;
  if (p.currency && p.currency !== "SGD" && p.foreignAmount !== null && p.fx !== null && p.fx > 0) {
    amount = Math.abs(p.foreignAmount);
    currency = p.currency;
    fx = Number(toScaled(p.fx, 8)) / 1e8; // stored with 8 decimals
  } else if (p.amountSgd !== null) {
    amount = Math.abs(p.amountSgd);
  } else {
    issues.push({ severity: "warning", sheet: "Payments", row: p.row, message: "Payment has no usable amount; skipped." });
    return null;
  }
  if (amount === 0) return null;
  const negative = (p.amountSgd ?? p.foreignAmount ?? 0) < 0;
  const date = p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date) ? p.date.slice(0, 10) : today;
  if (!p.date || date === today) {
    issues.push({ severity: "info", sheet: "Payments", row: p.row, message: "Payment date missing or unreadable; recorded with the import date." });
  }
  return {
    import_key: "",
    legacyId: p.legacyId,
    kind: negative ? "refund" : kind,
    amount: round2(amount),
    currency,
    fx_rate: fx,
    amount_sgd: convertCents(toCents(round2(amount))!, fx) / 100,
    paid_on: date,
    method: p.method,
    reference: p.reference,
    notes: [p.notes, p.proof ? `Proof: ${p.proof}` : null, "Imported from workbook Payments tab."].filter(Boolean).join(" "),
    supplierName: p.supplier,
  };
}
