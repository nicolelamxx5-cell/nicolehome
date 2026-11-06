import { expect, type Browser, type Page } from "@playwright/test";

/** Render a labelled placeholder PNG to stand in for a phone screenshot (test only). */
export async function fakeScreenshot(page: Page, label: string, colour: string) {
  const tmp = await page.context().newPage();
  await tmp.setViewportSize({ width: 360, height: 640 });
  await tmp.setContent(
    `<body style="margin:0;background:${colour};display:flex;align-items:center;justify-content:center;height:640px;font:28px sans-serif;color:#222">TEST IMAGE: ${label}</body>`,
  );
  const buffer = await tmp.screenshot({ type: "png" });
  await tmp.close();
  return { name: `${label.replace(/\W+/g, "-")}.png`, mimeType: "image/png", buffer };
}

export async function signUp(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: /Create an account/ }).click();
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/setup|\/$/);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function newPhone(browser: Browser) {
  const ctx = await browser.newContext({ ...(await import("@playwright/test")).devices["iPhone 13"] });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  return { ctx, page };
}

export async function budgetFigure(page: Page, testId: string) {
  await page.goto("/budget");
  return (await page.getByTestId(testId).innerText()).trim();
}

export async function expectBudget(page: Page, figures: Record<string, string>) {
  await page.goto("/budget");
  for (const [id, value] of Object.entries(figures)) await expect(page.getByTestId(id)).toHaveText(value);
}
