// Imports the homeowners' real workbook through the UI (skipped unless
// WORKBOOK_PATH points at it — the private file is never committed).
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { admin, resetAll } from "../integration/helpers";
import ExcelJS from "exceljs";
import { newPhone, signUp } from "./helpers";

const WB = process.env.WORKBOOK_PATH;
const OWNER = { email: "owner.import@example.com", password: "owner-pass-123" };

test.skip(!WB || !existsSync(WB), "WORKBOOK_PATH not set");

test("real workbook imports once; re-importing creates nothing new", async ({ browser }) => {
  await resetAll([OWNER.email, "owner.capture@example.com", "owner.e2e@example.com", "keith.e2e@example.com"]);
  const { page, ctx } = await newPhone(browser);
  await signUp(page, OWNER.email, OWNER.password);
  await page.fill("#displayName", "Nicole");
  await page.getByRole("button", { name: /Create our Home Hub/ }).click();
  await page.waitForURL(/more\/import/);

  await page.setInputFiles("#file", WB!);
  await page.getByTestId("run-import").click();
  await expect(page.getByText("Import complete")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("sum-items_created")).toHaveText("192");
  await expect(page.getByTestId("sum-items_linked")).toHaveText("1"); // the seeded sofa is row 03-005
  await expect(page.getByTestId("sum-errors")).toHaveText("0");

  const db = admin();
  const { count } = await db.from("required_items").select("id", { count: "exact", head: true });
  expect(count).toBe(193);
  const sofa = await db.from("required_items").select("name, specification, legacy_id").eq("legacy_id", "03-005").single();
  expect(sofa.data).toMatchObject({ name: "Main sofa", specification: "Cream upholstered sofa" });
  expect((await db.from("approvals").select("id")).data).toHaveLength(0);
  expect((await db.from("payments").select("id")).data).toHaveLength(0);

  // Second import of the same file
  await page.goto("/more/import");
  await page.setInputFiles("#file", WB!);
  await page.getByTestId("run-import").click();
  await expect(page.getByText("Import complete")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("sum-items_created")).toHaveText("0");
  await expect(page.getByTestId("sum-options_created")).toHaveText("0");
  expect((await db.from("required_items").select("id", { count: "exact", head: true })).count).toBe(193);

  // Budget forecast reflects workbook allowances, not commitments
  await page.goto("/budget");
  await expect(page.getByTestId("approved-commitments")).toHaveText("S$0.00");
  await expect(page.getByTestId("forecast")).toHaveText("S$7,977.00");

  // Excel export (backup) contains every room sheet and item
  const res = await page.request.get("/api/export");
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  expect(wb.worksheets.map((w) => w.name)).toEqual(expect.arrayContaining(["Summary", "Kitchen", "Living & Coffee Bar", "Options", "Payments", "Activity"]));
  const rows = wb.worksheets.filter((w) => !["Summary", "Options", "Approvals", "Payments", "Exchange rates", "Checks", "Comments", "Activity"].includes(w.name)).reduce((a, w) => a + w.rowCount - 1, 0);
  expect(rows).toBe(193);
  await ctx.close();
});
