import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { parseWorkbook } from "@/lib/import/parse";
import { planImport, deriveSourcing, type ExistingState, type ImportPlan } from "@/lib/import/plan";

const HEADERS = [
  "ID", "Category", "Item / Specification", "Priority", "Source Decision", "Supplier / Brand", "Model / SKU", "Qty",
  "Unit", "Est. Unit (SGD)", "Est. Total", "Quoted Unit (SGD)", "Quoted Total", "Ordered Unit (SGD)", "Committed Total",
  "Paid to Date (SGD)", "Balance to Pay", "Status", "Purchase By", "Reference URL", "Photo / File Link",
  "Dimensions / Finish", "Notes / Compliance",
];

type Row = Partial<Record<(typeof HEADERS)[number], unknown>>;

/** A TEST FIXTURE with the same layout as the homeowners' tracker. Contents are made up for tests only. */
async function fixture(opts: { sofaPaid?: number; extraRows?: Row[]; payments?: unknown[][] } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = (name: string, title: string, rows: Row[]) => {
    const ws = wb.addWorksheet(name);
    ws.getCell("A1").value = `${title}  |  661C PROCUREMENT`;
    ws.getCell("A2").value = "Enter quantities…";
    ws.getRow(4).values = HEADERS;
    rows.forEach((r, i) => {
      const n = 5 + i;
      ws.getRow(n).values = HEADERS.map((h) => r[h] ?? null) as ExcelJS.CellValue[];
      if (r["Est. Total"] === undefined) ws.getCell(`K${n}`).value = { formula: `IF(J${n}="","",H${n}*J${n})`, result: "" } as ExcelJS.CellFormulaValue;
    });
  };
  sheet("Whole House", "WHOLE HOUSE", [
    { ID: "01-001", Category: "Aircon", "Item / Specification": "Air-conditioning system + installation", Priority: "Warranty", "Source Decision": "Singapore", Qty: 1, Unit: "set", Status: "Not Started" },
  ]);
  sheet("Living & Coffee Bar", "LIVING & COFFEE BAR", [
    { ID: "03-005", Category: "Furniture", "Item / Specification": "Cream upholstered sofa", Priority: "High", "Source Decision": "China", Qty: 1, Unit: "set", Status: "Ordered", "Ordered Unit (SGD)": 1500, "Supplier / Brand": "Example Supplier", "Paid to Date (SGD)": opts.sofaPaid ?? null },
    { ID: "03-006", Category: "Furniture", "Item / Specification": "Island bar stools (left side)", Priority: "High", "Source Decision": "China", Qty: 3, Unit: "pc", "Est. Unit (SGD)": 120.5, Status: "Not Started" },
    ...(opts.extraRows ?? []),
  ]);
  sheet("Kitchen", "KITCHEN", [
    { ID: "05-011", Category: "Appliance", "Item / Specification": "Refrigerator", Priority: "Warranty", "Source Decision": "Singapore", "Supplier / Brand": "NIL", Qty: 1, Unit: "set", Status: "Not Started" },
    { ID: "05-020", Category: "Appliance", "Item / Specification": "Water dispenser", Priority: "Warranty", "Source Decision": "Compare", Qty: 1, Unit: "set", "Est. Unit (SGD)": 3000, "Est. Total": 2800, Status: "Not Started", "Reference URL": "https://www.example.sg/the-one" },
    { ID: "03-006", Category: "Furniture", "Item / Specification": "Duplicate ID row", Qty: 1 },
  ]);
  sheet("Main Bedroom", "MAIN BEDROOM", [
    { ID: "07-015", Category: "Aircon", "Item / Specification": "Bedroom aircon unit", Priority: "Warranty", "Source Decision": "Singapore", Qty: 1, Unit: "set", Status: "Not Started" },
  ]);
  const pay = wb.addWorksheet("Payments");
  pay.getCell("A1").value = "PAYMENTS & DEPOSITS";
  pay.getRow(3).values = ["Date", "Room", "Item ID", "Supplier", "Invoice / PO", "Type", "Currency", "Foreign Amount", "FX to SGD", "Amount SGD", "Payment Method", "Proof / URL", "Notes"];
  (opts.payments ?? []).forEach((p, i) => (pay.getRow(4 + i).values = p as ExcelJS.CellValue[]));
  const guide = wb.addWorksheet("Sourcing Guide");
  guide.getRow(1).values = ["Category", "Preferred", "Why / Decision", "Important Check"];
  guide.getRow(2).values = ["Tiles / stone", "China", "Largest saving", "Samples"];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const empty: ExistingState = { rooms: [], items: [], optionImportKeys: [], paymentImportKeys: [] };
const TODAY = "2026-11-06";

/** Simulate applying a plan so a second import can be planned against the result. */
function applied(plan: ImportPlan, prev: ExistingState = empty): ExistingState {
  const rooms = [...prev.rooms, ...plan.roomsToCreate.map((r, i) => ({ id: `room-${prev.rooms.length + i}`, name: r.name }))];
  const roomId = (n: string) => rooms.find((r) => r.name === n)!.id;
  const items = prev.items.map((it) => {
    const u = plan.itemsToUpdate.find((x) => x.id === it.id);
    return u ? { ...it, ...u.changes, import_snapshot: u.snapshot, ...(u.review ?? {}) } : it;
  });
  for (const c of plan.itemsToCreate) {
    const { roomName, ...fields } = c;
    items.push({ ...fields, id: `item-${c.legacy_id}`, room_id: roomId(roomName), import_snapshot: { ...fields } });
  }
  return {
    rooms,
    items,
    optionImportKeys: [...prev.optionImportKeys, ...plan.optionsToCreate.map((o) => o.import_key)],
    paymentImportKeys: [...prev.paymentImportKeys, ...plan.paymentsToCreate.map((p) => p.import_key)],
  };
}

describe("workbook parsing", () => {
  it("reads rooms, items, guidelines and flags problems", async () => {
    const parsed = await parseWorkbook(await fixture());
    expect(parsed.rooms.map((r) => r.name)).toEqual(["Whole House", "Living & Coffee Bar", "Kitchen", "Main Bedroom"]);
    expect(parsed.items.map((i) => i.legacyId)).toEqual(["01-001", "03-005", "03-006", "05-011", "05-020", "07-015"]);
    expect(parsed.guidelines).toHaveLength(1);
    const msgs = parsed.issues.map((i) => `${i.severity}: ${i.message}`).join("\n");
    expect(msgs).toMatch(/conflict: ID 03-006 already used/);
    expect(msgs).toMatch(/Supplier "NIL" read as "no supplier yet"/);
    expect(msgs).toMatch(/warning: "Est. Total" was typed in \(2800\) and does not match/);
    expect(msgs).toMatch(/Possible overlap: 01-001 .* and 07-015/);
    // Supplier NIL is not kept as a supplier name
    expect(parsed.items.find((i) => i.legacyId === "05-011")!.supplier).toBeNull();
  });

  it("maps source decisions to recommendations, keeping the original label", () => {
    expect(deriveSourcing("China - ARCFORM")).toBe("china");
    expect(deriveSourcing("China + SG installer")).toBe("china");
    expect(deriveSourcing("Metro / Singapore")).toBe("singapore");
    expect(deriveSourcing("Compare")).toBe("compare");
    expect(deriveSourcing(null)).toBe("undecided");
  });
});

describe("import planning", () => {
  it("creates items, flags overlaps, and keeps estimates separate from payments", async () => {
    const plan = planImport(await parseWorkbook(await fixture({ sofaPaid: 500 })), empty, TODAY);
    expect(plan.itemsToCreate).toHaveLength(6);
    const stools = plan.itemsToCreate.find((i) => i.legacy_id === "03-006")!;
    expect(stools).toMatchObject({ quantity: 3, estimate_unit: 120.5, specification: "Island bar stools (left side)" });
    expect(plan.itemsToCreate.find((i) => i.legacy_id === "07-015")!.needs_review).toBe(true);
    expect(plan.itemsToCreate.find((i) => i.legacy_id === "01-001")!.needs_review).toBe(true);
    // An "ordered" row becomes a flagged commitment, and the cumulative paid amount a single flagged payment.
    const sofa = plan.optionsToCreate.find((o) => o.legacyId === "03-005")!;
    expect(sofa.commitmentSgd).toBe(1500);
    expect(plan.paymentsToCreate).toHaveLength(1);
    expect(plan.paymentsToCreate[0]).toMatchObject({ import_key: "wb-paid:03-005", amount_sgd: 500 });
    // Water dispenser: candidate from URL, priced as an estimate (not a quotation)
    const water = plan.optionsToCreate.find((o) => o.legacyId === "05-020")!;
    expect(water).toMatchObject({ price: 3000, price_basis: "estimate", currency: "SGD", platform: "singapore_store" });
  });

  it("re-importing the same workbook creates nothing new (duplicate prevention)", async () => {
    const buf = await fixture({ sofaPaid: 500, payments: [["2026-10-01", "Living", "03-005", "Example", "INV-1", "Deposit", "CNY", 1000, 0.185, 185, "Alipay", "", ""]] });
    const first = planImport(await parseWorkbook(buf), empty, TODAY);
    const state = applied(first);
    const second = planImport(await parseWorkbook(buf), state, TODAY);
    expect(second.roomsToCreate).toHaveLength(0);
    expect(second.itemsToCreate).toHaveLength(0);
    expect(second.optionsToCreate).toHaveLength(0);
    expect(second.paymentsToCreate).toHaveLength(0);
    expect(second.conflicts).toHaveLength(0);
    expect(second.summary.items_unchanged).toBe(6);
  });

  it("uses Payments-tab entries instead of the cumulative column so payments are not counted twice", async () => {
    const plan = planImport(
      await parseWorkbook(
        await fixture({
          sofaPaid: 500,
          payments: [
            ["2026-10-01", "Living", "03-005", "Example", "INV-1", "Deposit", "CNY", 1000, 0.185, 185, "Alipay", "", ""],
            ["2026-10-20", "Living", "03-005", "Example", "INV-2", "Balance", "SGD", null, null, 315, "PayNow", "", ""],
          ],
        }),
      ),
      empty,
      TODAY,
    );
    expect(plan.paymentsToCreate.map((p) => [p.kind, p.currency, p.amount, p.amount_sgd])).toEqual([
      ["deposit", "CNY", 1000, 185],
      ["balance", "SGD", 315, 315],
    ]);
    expect(plan.issues.some((i) => /only the Payments-tab entries are imported/.test(i.message))).toBe(true);
  });

  it("updates rows changed in the workbook but never overwrites edits made in the app", async () => {
    const first = planImport(await parseWorkbook(await fixture()), empty, TODAY);
    const state = applied(first);
    // The owner renamed the sofa in the app and set a new stools quantity.
    const sofa = state.items.find((i) => i.legacy_id === "03-005")!;
    sofa.name = "Main sofa";
    const stools = state.items.find((i) => i.legacy_id === "03-006")!;
    stools.quantity = 4;
    // The workbook later changes the stools quantity too, and the bar stool estimate.
    const changed = await fixture({
      extraRows: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(changed as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Living & Coffee Bar")!;
    ws.getCell("H6").value = 2; // qty
    ws.getCell("J6").value = 99; // est unit
    const second = planImport(await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer())), state, TODAY);
    expect(second.itemsToCreate).toHaveLength(0);
    // App rename kept silently (workbook unchanged for that field)
    expect(second.itemsToUpdate.find((u) => u.legacyId === "03-005")).toBeUndefined();
    // Estimate changed only in the workbook → updated
    const u = second.itemsToUpdate.find((x) => x.legacyId === "03-006")!;
    expect(u.changes).toEqual({ estimate_unit: 99 });
    // Quantity changed in both → conflict reported, app value kept
    expect(second.conflicts).toEqual([{ legacyId: "03-006", field: "quantity", appValue: 4, workbookValue: 2 }]);
  });
});

const REAL = process.env.WORKBOOK_PATH;
describe.skipIf(!REAL || !existsSync(REAL ?? ""))("the homeowners' real workbook", () => {
  it("imports every room row exactly once", async () => {
    const parsed = await parseWorkbook(readFileSync(REAL!));
    expect(parsed.rooms).toHaveLength(13);
    expect(parsed.items).toHaveLength(193);
    expect(new Set(parsed.items.map((i) => i.legacyId)).size).toBe(193);
    expect(parsed.guidelines).toHaveLength(15);
    expect(parsed.payments).toHaveLength(0);
    const oven = parsed.items.find((i) => i.legacyId === "05-014")!;
    expect(oven).toMatchObject({ supplier: "Bosch", model: "CMG7361B1B", estimateUnit: 4189 });
    const plan = planImport(parsed, empty, TODAY);
    expect(plan.itemsToCreate).toHaveLength(193);
    expect(plan.paymentsToCreate).toHaveLength(0);
    const again = planImport(parsed, applied(plan), TODAY);
    expect(again.itemsToCreate.length + again.optionsToCreate.length + again.conflicts.length).toBe(0);
  });
});
