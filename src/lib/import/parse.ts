// Reads the homeowners' renovation tracker (.xlsx / .xlsm). It finds sheets by
// their header row rather than fixed positions, keeps text verbatim, and
// reports anything ambiguous instead of guessing. Formulas and macros are not
// carried over: totals are recomputed from the input cells.

import ExcelJS from "exceljs";

export type Severity = "info" | "warning" | "conflict";

export interface ImportIssue {
  severity: Severity;
  sheet?: string;
  row?: number;
  legacyId?: string;
  relatedIds?: string[];
  message: string;
}

export interface ParsedRoom {
  sheet: string;
  name: string;
  prefix: string | null;
  order: number;
  isWholeHouse: boolean;
}

export interface ParsedItemRow {
  sheet: string;
  roomName: string;
  row: number;
  legacyId: string;
  category: string | null;
  specification: string;
  priority: string | null;
  sourceDecision: string | null;
  supplier: string | null;
  model: string | null;
  quantity: number | null;
  unit: string | null;
  estimateUnit: number | null;
  estimateTotalCell: { value: number | null; isFormula: boolean };
  quotedUnit: number | null;
  orderedUnit: number | null;
  paidToDate: number | null;
  status: string | null;
  purchaseBy: string | null;
  referenceUrl: string | null;
  photoLink: string | null;
  dimensions: string | null;
  notes: string | null;
}

export interface ParsedPayment {
  row: number;
  date: string | null;
  room: string | null;
  legacyId: string | null;
  supplier: string | null;
  reference: string | null;
  type: string | null;
  currency: string | null;
  foreignAmount: number | null;
  fx: number | null;
  amountSgd: number | null;
  method: string | null;
  proof: string | null;
  notes: string | null;
}

export interface ParsedGuideline {
  category: string;
  preferred: string | null;
  rationale: string | null;
  importantCheck: string | null;
  order: number;
}

export interface ParsedWorkbook {
  rooms: ParsedRoom[];
  items: ParsedItemRow[];
  payments: ParsedPayment[];
  guidelines: ParsedGuideline[];
  dashboard: { estimatedTotal: number | null; committedTotal: number | null; paidTotal: number | null } | null;
  sheetNames: string[];
  ignoredSheets: string[];
  issues: ImportIssue[];
}

/** Sheets that cover the whole home rather than one room. */
export const HOUSE_WIDE_SHEETS = ["Whole House", "Doors & Windows", "General Essentials"];

const ITEM_HEADERS: Record<string, keyof ParsedItemRow | "estimateTotal"> = {
  "id": "legacyId",
  "category": "category",
  "item / specification": "specification",
  "priority": "priority",
  "source decision": "sourceDecision",
  "supplier / brand": "supplier",
  "model / sku": "model",
  "qty": "quantity",
  "unit": "unit",
  "est. unit (sgd)": "estimateUnit",
  "est. total": "estimateTotal",
  "quoted unit (sgd)": "quotedUnit",
  "ordered unit (sgd)": "orderedUnit",
  "paid to date (sgd)": "paidToDate",
  "status": "status",
  "purchase by": "purchaseBy",
  "reference url": "referenceUrl",
  "photo / file link": "photoLink",
  "dimensions / finish": "dimensions",
  "notes / compliance": "notes",
};

type CellValue = ExcelJS.CellValue;

function isFormulaValue(v: CellValue): v is ExcelJS.CellFormulaValue {
  return typeof v === "object" && v !== null && ("formula" in v || "sharedFormula" in v);
}

/** Plain value of a cell: formula results, rich text and hyperlinks flattened. */
export function cellPlain(v: CellValue): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  if (isFormulaValue(v)) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    if (r === undefined || r === null) return null;
    if (typeof r === "object" && !(r instanceof Date)) return null; // error value
    return r as string | number | boolean | Date;
  }
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "hyperlink" in v) {
    const h = v as ExcelJS.CellHyperlinkValue;
    return h.hyperlink || (typeof h.text === "string" ? h.text : null);
  }
  if (typeof v === "object" && "error" in v) return null;
  return null;
}

function text(v: CellValue): string | null {
  const p = cellPlain(v);
  if (p === null) return null;
  if (p instanceof Date) return p.toISOString().slice(0, 10);
  const s = String(p).trim();
  return s === "" ? null : s;
}

function num(v: CellValue): number | null {
  const p = cellPlain(v);
  if (p === null || p === "") return null;
  if (typeof p === "number") return Number.isFinite(p) ? p : null;
  if (typeof p === "string") {
    const cleaned = p.replace(/[,\s]|S\$|SGD|\$/gi, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function headerKey(v: CellValue): string {
  return (text(v) ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function findHeaderRow(ws: ExcelJS.Worksheet, required: string[], maxRow = 12): { row: number; cols: Map<string, number> } | null {
  for (let r = 1; r <= Math.min(maxRow, ws.rowCount); r++) {
    const cols = new Map<string, number>();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const k = headerKey(cell.value);
      if (k && !cols.has(k)) cols.set(k, col);
    });
    if (required.every((h) => cols.has(h))) return { row: r, cols };
  }
  return null;
}

export function friendlyRoomName(sheet: string, titleCell: string | null): string {
  // Title cells look like "BEDROOM 3 / FLEX  |  661C PROCUREMENT"
  if (titleCell && titleCell.includes("|")) {
    const t = titleCell.split("|")[0].trim();
    if (t) {
      return t
        .toLowerCase()
        .split(/\s+/)
        .map((w) => (w === "&" || w === "/" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");
    }
  }
  return sheet.replace(/\s{2,}/g, " ").trim();
}

export async function parseWorkbook(data: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS reads .xlsm like .xlsx; the VBA project is ignored.
  await wb.xlsx.load(data as ArrayBuffer);

  const out: ParsedWorkbook = {
    rooms: [],
    items: [],
    payments: [],
    guidelines: [],
    dashboard: null,
    sheetNames: wb.worksheets.map((w) => w.name),
    ignoredSheets: [],
    issues: [],
  };

  let order = 0;
  const seenIds = new Map<string, { sheet: string; row: number }>();

  for (const ws of wb.worksheets) {
    const itemHeader = findHeaderRow(ws, ["id", "item / specification"]);
    if (itemHeader) {
      const title = text(ws.getRow(1).getCell(1).value);
      const roomName = friendlyRoomName(ws.name, title);
      const room: ParsedRoom = {
        sheet: ws.name,
        name: roomName,
        prefix: null,
        order: order++,
        isWholeHouse: HOUSE_WIDE_SHEETS.includes(ws.name.trim()),
      };
      out.rooms.push(room);

      const col = (h: string) => itemHeader.cols.get(h);
      for (const [h] of Object.entries(ITEM_HEADERS)) {
        if (!itemHeader.cols.has(h)) {
          out.issues.push({ severity: "info", sheet: ws.name, message: `Column "${h}" not found; left blank.` });
        }
      }

      for (let r = itemHeader.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (h: string): CellValue => {
          const c = col(h);
          return c ? row.getCell(c).value : null;
        };
        const legacyId = text(get("id"));
        const spec = text(get("item / specification"));
        if (!legacyId && !spec) continue;
        if (!legacyId || !spec) {
          out.issues.push({
            severity: "warning",
            sheet: ws.name,
            row: r,
            legacyId: legacyId ?? undefined,
            message: !legacyId ? `Row has a description ("${spec}") but no ID — skipped.` : "Row has an ID but no description — skipped.",
          });
          continue;
        }
        if (seenIds.has(legacyId)) {
          const first = seenIds.get(legacyId)!;
          out.issues.push({
            severity: "conflict",
            sheet: ws.name,
            row: r,
            legacyId,
            message: `ID ${legacyId} already used on ${first.sheet} row ${first.row}; this row was not imported.`,
          });
          continue;
        }
        seenIds.set(legacyId, { sheet: ws.name, row: r });
        if (!room.prefix && /^\d{2}-\d{3}$/.test(legacyId)) room.prefix = legacyId.slice(0, 2);

        const estTotalRaw = get("est. total");
        const supplierRaw = text(get("supplier / brand"));
        let supplier = supplierRaw;
        if (supplierRaw && /^(nil|n\/a|na|none|-)$/i.test(supplierRaw)) {
          supplier = null;
          out.issues.push({
            severity: "info",
            sheet: ws.name,
            row: r,
            legacyId,
            message: `Supplier "${supplierRaw}" read as "no supplier yet".`,
          });
        }
        const item: ParsedItemRow = {
          sheet: ws.name,
          roomName,
          row: r,
          legacyId,
          category: text(get("category")),
          specification: spec,
          priority: text(get("priority")),
          sourceDecision: text(get("source decision")),
          supplier,
          model: text(get("model / sku")),
          quantity: num(get("qty")),
          unit: text(get("unit")),
          estimateUnit: num(get("est. unit (sgd)")),
          estimateTotalCell: { value: num(estTotalRaw), isFormula: isFormulaValue(estTotalRaw) },
          quotedUnit: num(get("quoted unit (sgd)")),
          orderedUnit: num(get("ordered unit (sgd)")),
          paidToDate: num(get("paid to date (sgd)")),
          status: text(get("status")),
          purchaseBy: text(get("purchase by")),
          referenceUrl: text(get("reference url")),
          photoLink: text(get("photo / file link")),
          dimensions: text(get("dimensions / finish")),
          notes: text(get("notes / compliance")),
        };
        out.items.push(item);

        // Hard-coded totals (formula overwritten) — report, recompute from inputs.
        if (!item.estimateTotalCell.isFormula && item.estimateTotalCell.value !== null) {
          const expected = item.estimateUnit !== null ? item.estimateUnit * (item.quantity ?? 1) : null;
          const same = expected !== null && Math.abs(expected - item.estimateTotalCell.value) < 0.005;
          out.issues.push({
            severity: same ? "info" : "warning",
            sheet: ws.name,
            row: r,
            legacyId,
            message: same
              ? `"Est. Total" was typed in rather than calculated (${item.estimateTotalCell.value}); it matches Qty × Est. Unit.`
              : `"Est. Total" was typed in (${item.estimateTotalCell.value}) and does not match Qty × Est. Unit (${expected ?? "blank"}). The app uses Qty × Est. Unit${item.estimateUnit === null ? " — no estimate was imported" : ""}.`,
          });
        }
        const progressed = ["approved", "ordered", "in transit", "delivered", "installed"];
        if (item.status && progressed.includes(item.status.toLowerCase()) && item.orderedUnit === null) {
          out.issues.push({
            severity: "warning",
            sheet: ws.name,
            row: r,
            legacyId,
            message: `Status is "${item.status}" but no ordered price is recorded; imported as not yet approved.`,
          });
        }
      }
      continue;
    }

    const payHeader = findHeaderRow(ws, ["date", "item id", "amount sgd"]);
    if (payHeader) {
      const c = (h: string) => payHeader.cols.get(h);
      for (let r = payHeader.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (h: string): CellValue => (c(h) ? row.getCell(c(h)!).value : null);
        const p: ParsedPayment = {
          row: r,
          date: text(get("date")),
          room: text(get("room")),
          legacyId: text(get("item id")),
          supplier: text(get("supplier")),
          reference: text(get("invoice / po")),
          type: text(get("type")),
          currency: text(get("currency"))?.toUpperCase() ?? null,
          foreignAmount: num(get("foreign amount")),
          fx: num(get("fx to sgd")),
          amountSgd: num(get("amount sgd")),
          method: text(get("payment method")),
          proof: text(get("proof / url")),
          notes: text(get("notes")),
        };
        if (p.amountSgd === null && p.foreignAmount === null && !p.legacyId && !p.date) continue;
        out.payments.push(p);
      }
      continue;
    }

    const guideHeader = findHeaderRow(ws, ["category", "preferred"]);
    if (guideHeader) {
      const c = (h: string) => guideHeader.cols.get(h);
      for (let r = guideHeader.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const get = (h: string): CellValue => (c(h) ? row.getCell(c(h)!).value : null);
        const category = text(get("category"));
        if (!category) continue;
        out.guidelines.push({
          category,
          preferred: text(get("preferred")),
          rationale: text(get("why / decision")),
          importantCheck: text(get("important check")),
          order: out.guidelines.length,
        });
      }
      continue;
    }

    if (/dashboard/i.test(ws.name)) {
      // Read cached formula results only, to reconcile against our own totals.
      const find = (label: string): number | null => {
        for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
          const row = ws.getRow(r);
          let hit: number | null = null;
          row.eachCell((cell, col) => {
            if (headerKey(cell.value) === label) hit = col;
          });
          if (hit !== null) return num(ws.getRow(r + 1).getCell(hit).value);
        }
        return null;
      };
      out.dashboard = {
        estimatedTotal: find("estimated total"),
        committedTotal: find("committed orders"),
        paidTotal: find("actually paid"),
      };
      continue;
    }

    out.ignoredSheets.push(ws.name);
    out.issues.push({ severity: "info", sheet: ws.name, message: "Sheet not recognised as a room, payments or sourcing sheet; not imported." });
  }

  if (out.rooms.length === 0) {
    out.issues.push({ severity: "conflict", message: "No room sheets with an ID / Item header were found. Is this the renovation tracker?" });
  }

  out.issues.push(...findOverlaps(out.items));

  // Payments recorded both as a cumulative "Paid to Date" and on the Payments tab.
  const paymentIds = new Set(out.payments.map((p) => p.legacyId).filter(Boolean));
  for (const i of out.items) {
    if (i.paidToDate && paymentIds.has(i.legacyId)) {
      out.issues.push({
        severity: "warning",
        sheet: i.sheet,
        row: i.row,
        legacyId: i.legacyId,
        message: `"Paid to Date" (${i.paidToDate}) and Payments-tab entries both exist; only the Payments-tab entries are imported to avoid counting twice.`,
      });
    }
  }
  for (const p of out.payments) {
    if (p.legacyId && !seenIds.has(p.legacyId)) {
      out.issues.push({ severity: "warning", sheet: "Payments", row: p.row, message: `Payment refers to unknown item ID "${p.legacyId}".` });
    }
    if (p.foreignAmount !== null && p.fx !== null && p.amountSgd !== null && Math.abs(p.foreignAmount * p.fx - p.amountSgd) > 0.01) {
      out.issues.push({
        severity: "warning",
        sheet: "Payments",
        row: p.row,
        message: `Amount SGD ${p.amountSgd} differs from Foreign Amount × FX (${(p.foreignAmount * p.fx).toFixed(2)}).`,
      });
    }
  }

  if (out.dashboard?.estimatedTotal !== null && out.dashboard?.estimatedTotal !== undefined) {
    const ours = out.items.reduce((a, i) => a + (i.estimateUnit ?? 0) * (i.quantity ?? 1), 0);
    const theirs = out.dashboard.estimatedTotal;
    if (Math.abs(ours - theirs) > 0.005) {
      out.issues.push({
        severity: "info",
        sheet: "Dashboard",
        message: `The workbook dashboard's saved estimate total (${theirs}) differs from Qty × Est. Unit summed across rows (${ours}). Hard-coded totals and blank units explain differences; the app uses Qty × Est. Unit.`,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Overlap detection between house-wide sheets and room sheets
// ---------------------------------------------------------------------------
const STOP = new Set([
  "and", "or", "the", "a", "an", "of", "for", "if", "to", "with", "in", "on", "per", "set", "new",
  "needed", "required", "require", "applicable", "optional", "works", "work", "changes", "change",
  "system", "existing", "where", "necessary", "only", "possible", "etc",
]);
const SYNONYMS: Record<string, string> = {
  "air-conditioning": "aircon",
  "airconditioning": "aircon",
  "aircons": "aircon",
  "grilles": "grille",
  "grill": "grille",
  "extinguishers": "extinguisher",
  "doors": "door",
  "locks": "lock",
  "windows": "window",
  "fans": "fan",
  "lights": "light",
};

export function tokens(s: string): Set<string> {
  const cleaned = s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9\- ]+/g, " ");
  const out = new Set<string>();
  for (let w of cleaned.split(/\s+/)) {
    w = w.replace(/^-+|-+$/g, "");
    if (!w || STOP.has(w) || w.length < 3) continue;
    w = SYNONYMS[w] ?? w;
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = SYNONYMS[w] ?? w.slice(0, -1);
    out.add(w);
  }
  return out;
}

export function findOverlaps(items: ParsedItemRow[]): ImportIssue[] {
  const toks = items.map((i) => tokens(i.specification));
  const freq = new Map<string, number>();
  for (const t of toks) for (const w of t) freq.set(w, (freq.get(w) ?? 0) + 1);
  const issues: ImportIssue[] = [];
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const A = items[a];
      const B = items[b];
      if (A.sheet === B.sheet) continue;
      const aWide = HOUSE_WIDE_SHEETS.includes(A.sheet.trim());
      const bWide = HOUSE_WIDE_SHEETS.includes(B.sheet.trim());
      if (!aWide && !bWide) continue; // two different rooms legitimately need their own basin
      const shared = [...toks[a]].filter((w) => toks[b].has(w));
      if (shared.length === 0) continue;
      const coeff = shared.length / Math.min(toks[a].size, toks[b].size);
      const sameCategory = !!A.category && (A.category ?? "").trim().toLowerCase() === (B.category ?? "").trim().toLowerCase();
      const rare = shared.some((w) => w.length >= 6 && (freq.get(w) ?? 0) <= 2);
      if ((shared.length >= 2 && coeff >= 0.75) || (rare && sameCategory)) {
        issues.push({
          severity: "warning",
          sheet: B.sheet,
          row: B.row,
          legacyId: B.legacyId,
          relatedIds: [A.legacyId, B.legacyId],
          message: `Possible overlap: ${A.legacyId} "${A.specification}" (${A.sheet}) and ${B.legacyId} "${B.specification}" (${B.sheet}). Both were imported and flagged for review so the cost is not counted twice by mistake.`,
        });
      }
    }
  }
  return issues;
}
