// Screenshot capture: several screenshots → several options in a few taps,
// offline queueing with safe sync, and the Android share target.
import { test, expect } from "@playwright/test";
import { admin, resetAll } from "../integration/helpers";
import { fakeScreenshot, newPhone, signUp } from "./helpers";

const OWNER = { email: "owner.capture@example.com", password: "owner-pass-123" };
test.describe.configure({ mode: "serial" });

test("three pendant screenshots become three options under one new item", async ({ browser }) => {
  await resetAll([OWNER.email, "owner.e2e@example.com", "keith.e2e@example.com"]);
  const { page, ctx } = await newPhone(browser);
  await signUp(page, OWNER.email, OWNER.password);
  await page.fill("#displayName", "Nicole");
  await page.getByRole("button", { name: /Create our Home Hub/ }).click();
  await page.waitForURL(/more\/import/);

  await page.goto("/add");
  const shots = [await fakeScreenshot(page, "pendant 1", "#efe6d6"), await fakeScreenshot(page, "pendant 2", "#e6efe0"), await fakeScreenshot(page, "pendant 3", "#e0e6ef")];
  await page.getByTestId("file-input").setInputFiles(shots);
  await expect(page.getByRole("radio", { name: "3 different products" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Dining", exact: true }).click();
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByLabel("New item name").fill("Dining pendant light");
  await page.getByTestId("save-capture").click();
  await page.waitForURL(/\/items\//, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Dining pendant light" })).toBeVisible();
  await expect(page.getByTestId("option-card")).toHaveCount(3);
  // Each card shows its own uploaded photo (a signed, private URL)
  const srcs = await page.getByTestId("option-card").locator("img").evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).src));
  expect(srcs).toHaveLength(3);
  for (const s of srcs) expect(s).toMatch(/\/storage\/v1\/object\/sign\/household-files\/.+token=/);
  // Lighting checks were attached automatically, including neutral-white light
  await page.getByTestId("option-card").first().click();
  await expect(page.getByText(/neutral white \(about 4000K\)/)).toBeVisible();
  await ctx.close();
});

test("a capture made offline is kept on the phone and uploaded once online", async ({ browser }) => {
  const { page, ctx } = await newPhone(browser);
  await page.goto("/login");
  await page.fill("#email", OWNER.email);
  await page.fill("#password", OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  // Let the service worker install and take control, then load Add once online.
  await page.goto("/add");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto("/add");
  await expect(page.getByRole("heading", { name: "What did you find?" })).toBeVisible();

  await ctx.setOffline(true);
  await page.reload(); // served from the copy saved on the phone
  await expect(page.getByRole("heading", { name: "What did you find?" })).toBeVisible();
  await expect(page.getByText(/You are offline/)).toBeVisible();

  await page.getByTestId("file-input").setInputFiles([await fakeScreenshot(page, "showroom tile", "#ddd5c8")]);
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: "New item" }).click();
  await page.getByLabel("New item name").fill("Kitchen wall tile (showroom)");
  await page.getByTestId("save-capture").click();
  await expect(page.getByTestId("saved-offline")).toBeVisible();

  const db = admin();
  const before = await db.from("required_items").select("id").eq("name", "Kitchen wall tile (showroom)");
  expect(before.data).toHaveLength(0);

  await ctx.setOffline(false); // the queue sends on the "online" event
  await expect
    .poll(async () => (await db.from("required_items").select("id").eq("name", "Kitchen wall tile (showroom)")).data?.length, { timeout: 30_000 })
    .toBe(1);
  const item = (await db.from("required_items").select("id").eq("name", "Kitchen wall tile (showroom)").single()).data!;
  const opts = await db.from("product_options").select("id").eq("required_item_id", item.id);
  expect(opts.data).toHaveLength(1);
  // Photos upload after the option row is created
  await expect
    .poll(async () => (await db.from("option_images").select("storage_path").eq("option_id", opts.data![0].id)).data?.length, { timeout: 30_000 })
    .toBe(1);
  await expect(page.getByTestId("queue-status")).toHaveCount(0, { timeout: 15_000 });

  await ctx.close();
});

test("photos shared from another app open in Add (Android share target)", async ({ browser }) => {
  const { page, ctx } = await newPhone(browser);
  await page.goto("/login");
  await page.fill("#email", OWNER.email);
  await page.fill("#password", OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const shot = await fakeScreenshot(page, "shared from taobao", "#e9e1d3");
  const landed = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append("files", new File([bytes], "taobao.png", { type: "image/png" }));
    fd.append("text", "看看这个 https://item.taobao.com/item.htm?id=123");
    const r = await fetch("/share-target", { method: "POST", body: fd });
    return r.url;
  }, shot.buffer.toString("base64"));
  expect(landed).toMatch(/\/add\?shared=1/);
  await page.goto(landed);
  await expect(page.getByAltText("Selected")).toHaveCount(1);
  await expect(page.getByLabel("Product link")).toHaveValue("https://item.taobao.com/item.htm?id=123");
  await ctx.close();
});
