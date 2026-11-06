import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getContext, can } from "@/lib/context";
import { loadBudget } from "@/lib/queries";
import { toCents } from "@/lib/money";

// Excel backup of everything. The database is the master; this file is a
// snapshot (values only — no formulas or macros).
export async function GET() {
  const ctx = await getContext();
  if (!can(ctx.member, "export")) return NextResponse.json({ error: "No permission to export" }, { status: 403 });
  const { supabase, household, names } = ctx;
  const data = await loadBudget(ctx);
  const hh = household.id;
  const [options, checks, comments, prefs, audit] = await Promise.all([
    supabase.from("product_options").select("*").eq("household_id", hh).order("created_at"),
    supabase.from("option_checks").select("*").eq("household_id", hh),
    supabase.from("option_comments").select("*").eq("household_id", hh).order("created_at"),
    supabase.from("option_preferences").select("*").eq("household_id", hh),
    supabase.from("audit_log").select("*").eq("household_id", hh).order("id", { ascending: false }).limit(5000),
  ]);
  const s = data.summary;
  const line = new Map(s.items.map((l) => [l.itemId, l]));
  const optionById = new Map((options.data ?? []).map((o) => [o.id, o]));
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const sgd = (c: number | null | undefined) => (c === null || c === undefined ? null : c / 100);

  const wb = new ExcelJS.Workbook();
  wb.creator = "661C Home Hub";
  wb.created = new Date();
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Figure (SGD)", key: "k", width: 44 }, { header: "Amount", key: "v", width: 16 }, { header: "Meaning", key: "m", width: 90 }];
  header(sum);
  sum.addRows([
    { k: "Total budget", v: sgd(s.totalBudget), m: "Amount set aside for the renovation" },
    { k: "Forecast final cost", v: sgd(s.forecastFinalCost), m: "Approved choices + allowances / highest shortlisted for the rest + shared costs + contingency" },
    { k: "Approved commitments", v: sgd(s.approvedCommitments), m: "Cost snapshot of the one active approval per item, plus committed shared costs" },
    { k: "Actual paid", v: sgd(s.actualPaid), m: "All payments minus refunds" },
    { k: "Outstanding on approved choices", v: sgd(s.outstanding), m: "Approved cost minus payments against it" },
    { k: "Paid towards replaced/cancelled choices", v: sgd(s.replacedSpend), m: "Included in actual paid; not part of current commitments" },
    { k: "Remaining vs commitments", v: sgd(s.remainingVsCommitted), m: "Total budget minus approved + already spent" },
    { k: "Remaining vs forecast", v: sgd(s.remainingVsForecast), m: "Total budget minus forecast final cost" },
    { k: "Exported", v: null, m: new Date().toISOString() },
  ]);
  sum.getColumn("v").numFmt = "#,##0.00";

  // Room sheets in the original workbook column order (values only)
  for (const room of data.rooms) {
    const ws = wb.addWorksheet(room.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.columns = [
      { header: "ID", key: "id", width: 9 },
      { header: "Category", key: "cat", width: 14 },
      { header: "Item / Specification", key: "spec", width: 44 },
      { header: "Priority", key: "pri", width: 12 },
      { header: "Source Decision", key: "src", width: 18 },
      { header: "Supplier / Brand", key: "sup", width: 18 },
      { header: "Model / SKU", key: "sku", width: 14 },
      { header: "Qty", key: "qty", width: 6 },
      { header: "Unit", key: "unit", width: 6 },
      { header: "Est. Unit (SGD)", key: "est", width: 12 },
      { header: "Est. Total", key: "estT", width: 12 },
      { header: "Approved option", key: "appr", width: 30 },
      { header: "Committed Total", key: "com", width: 14 },
      { header: "Paid to Date (SGD)", key: "paid", width: 14 },
      { header: "Balance to Pay", key: "bal", width: 14 },
      { header: "Forecast (SGD)", key: "fc", width: 14 },
      { header: "Status", key: "st", width: 16 },
      { header: "Reference URL", key: "url", width: 30 },
      { header: "Dimensions / Finish", key: "dim", width: 20 },
      { header: "Notes / Compliance", key: "notes", width: 30 },
      { header: "App name", key: "name", width: 24 },
    ];
    header(ws);
    for (const i of data.items.filter((x) => x.room_id === room.id && !x.is_archived)) {
      const l = line.get(i.id);
      const ap = l?.activeApprovalId ? data.approvals.find((a) => a.id === l.activeApprovalId) : undefined;
      const opt = ap ? optionById.get(ap.option_id) : undefined;
      ws.addRow({
        id: i.legacy_id,
        cat: i.workbook_category,
        spec: i.specification ?? i.name,
        pri: i.priority_label,
        src: i.source_decision_label ?? i.sourcing,
        sup: opt?.supplier_name ?? null,
        sku: opt?.model_sku ?? null,
        qty: Number(i.quantity),
        unit: i.unit,
        est: i.estimate_unit === null ? null : Number(i.estimate_unit),
        estT: sgd(l?.allowance),
        appr: opt?.title ?? null,
        com: sgd(l?.approvedCost || null),
        paid: sgd(l?.paid || null),
        bal: sgd(l?.activeApprovalId ? l.outstanding : null),
        fc: sgd(l?.forecast),
        st: ap ? (ap.ordered_at ? "Ordered" : "Approved") : (l?.optionCount ?? 0) > 0 ? "Shortlisting" : "Not Started",
        url: i.reference_url ?? opt?.url ?? null,
        dim: i.dimensions_finish,
        notes: [i.notes, i.review_note].filter(Boolean).join(" | ") || null,
        name: i.name,
      });
    }
    for (const k of ["est", "estT", "com", "paid", "bal", "fc"]) ws.getColumn(k).numFmt = "#,##0.00";
  }

  const os = wb.addWorksheet("Options");
  os.columns = [
    "Item ID", "Item", "Option", "Status", "Supplier", "Platform", "Contact", "Model / SKU", "URL", "Price", "Currency", "Price basis", "Price note",
    "Quantity", "Other charges", "Freight", "Freight currency", "Dimensions", "Material", "Colour", "Configuration", "Warranty", "Warranty duration",
    "Warranty valid in SG", "Warranty verified", "Votes", "Notes", "Created",
  ].map((h) => ({ header: h, key: h, width: 16 }));
  header(os);
  for (const o of options.data ?? []) {
    const item = itemById.get(o.required_item_id);
    os.addRow([
      item?.legacy_id, item?.name, o.title, o.status, o.supplier_name, o.platform, o.contact, o.model_sku, o.url, o.price, o.currency ?? "NOT CONFIRMED", o.price_basis, o.price_note,
      Number(o.quantity), o.other_charges, o.freight_allowance, o.freight_currency, o.dimensions, o.material, o.colour, o.configuration, o.warranty_provided, o.warranty_duration,
      o.warranty_valid_sg, o.warranty_verified ? "yes" : "claim only",
      (prefs.data ?? []).filter((p) => p.option_id === o.id).map((p) => `${names.get(p.user_id)}: ${p.vote}`).join("; "),
      o.notes, o.created_at,
    ]);
  }

  const as = wb.addWorksheet("Approvals");
  as.columns = ["Item", "Option", "Status", "Approved at", "Approved by", "Unit price", "Currency", "Qty", "FX rate", "FX source", "FX date", "Goods SGD", "Freight SGD", "Cost SGD", "Ordered at", "Override", "Ended", "Reason"].map((h) => ({ header: h, key: h, width: 16 }));
  header(as);
  for (const a of data.approvals) {
    as.addRow([itemById.get(a.required_item_id)?.name, optionById.get(a.option_id)?.title, a.status, a.approved_at, names.get(a.approved_by ?? ""), a.unit_price, a.currency, Number(a.quantity), a.fx_rate, a.fx_source, a.fx_as_of, a.goods_sgd, a.freight_sgd, a.cost_sgd, a.ordered_at, a.order_override_note, a.ended_at, a.end_reason]);
  }

  const ps = wb.addWorksheet("Payments");
  ps.columns = ["Date", "Item", "Type", "Currency", "Amount", "FX to SGD", "FX source", "Amount SGD (signed)", "Method", "Reference", "Notes", "Needs reconciliation"].map((h) => ({ header: h, key: h, width: 16 }));
  header(ps);
  for (const p of data.payments) {
    const signed = ((p.kind === "refund" ? -1 : 1) * (toCents(p.amount_sgd) ?? 0)) / 100;
    ps.addRow([p.paid_on, p.required_item_id ? itemById.get(p.required_item_id)?.name : "", p.kind, p.currency, p.amount, p.fx_rate, p.fx_source, signed, p.method, p.reference, p.notes, p.needs_reconciliation ? "yes" : ""]);
  }

  const rs = wb.addWorksheet("Exchange rates");
  rs.columns = ["Currency", "SGD per unit", "Date", "Source"].map((h) => ({ header: h, key: h, width: 18 }));
  header(rs);
  for (const r of data.rates) rs.addRow([r.currency, r.rate_to_sgd, r.as_of, r.source]);

  const cs = wb.addWorksheet("Checks");
  cs.columns = ["Option", "Check", "Critical", "State", "Evidence", "Confirmed by", "At"].map((h) => ({ header: h, key: h, width: 22 }));
  header(cs);
  for (const c of checks.data ?? []) cs.addRow([optionById.get(c.option_id)?.title, c.title, c.critical ? "yes" : "", c.state, c.evidence, c.resolved_by ? names.get(c.resolved_by) : "", c.resolved_at]);

  const ms = wb.addWorksheet("Comments");
  ms.columns = ["Option", "By", "When", "Comment"].map((h) => ({ header: h, key: h, width: 24 }));
  header(ms);
  for (const c of comments.data ?? []) ms.addRow([optionById.get(c.option_id)?.title, names.get(c.user_id), c.created_at, c.body]);

  const ls = wb.addWorksheet("Activity");
  ls.columns = ["When", "Who", "Action", "Record", "Changes"].map((h) => ({ header: h, key: h, width: 22 }));
  header(ls);
  for (const a of audit.data ?? []) ls.addRow([a.created_at, a.actor_id ? names.get(a.actor_id) ?? a.actor_id : "system", a.action, a.entity, JSON.stringify(a.changes).slice(0, 2000)]);

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="661C-Home-Hub-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
