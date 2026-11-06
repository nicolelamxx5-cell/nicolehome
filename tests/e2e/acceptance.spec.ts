// The first end-to-end acceptance test from the brief (steps 1–20), on an
// emulated iPhone, against the real app + local Supabase (auth, RLS, storage).
import { test, expect, type Page } from "@playwright/test";
import { resetAll } from "../integration/helpers";
import { fakeScreenshot, newPhone, signIn, signUp, expectBudget } from "./helpers";

const OWNER = { email: "owner.e2e@example.com", password: "owner-pass-123" };
const KEITH = { email: "keith.e2e@example.com", password: "keith-pass-123" };

test.describe.configure({ mode: "serial" });

async function openSofa(page: Page) {
  await page.goto("/shop");
  await page.getByRole("link", { name: /Living & Coffee Bar/ }).click();
  await page.getByRole("link", { name: /Main sofa/ }).click();
  await expect(page.getByRole("heading", { name: "Main sofa" })).toBeVisible();
}

async function openOption(page: Page, title: RegExp) {
  await openSofa(page);
  await page.getByTestId("option-card").filter({ hasText: title }).click();
  await page.waitForURL(/\/options\//);
}

test("acceptance: sofa comparison, approval, deposit, switch, permissions", async ({ browser }) => {
  await resetAll([OWNER.email, KEITH.email]);
  const owner = await newPhone(browser);
  const o = owner.page;

  // 1. Owner logs in (first account creates the household)
  await signUp(o, OWNER.email, OWNER.password);
  await o.fill("#displayName", "Nicole");
  await o.getByRole("button", { name: /Create our Home Hub/ }).click();
  await o.waitForURL(/more\/import/);

  // Set a total budget so "remaining" can be checked
  await o.goto("/budget/plan");
  await o.fill("#total_budget", "50000");
  await o.getByRole("button", { name: "Save budgets" }).click();
  await expect(o.getByText("Budgets saved")).toBeVisible();

  // 2–3. Living room → Main sofa; both candidates exist as separate cards (6)
  await openSofa(o);
  const cards = o.getByTestId("option-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Lunavelle Bouclé Sectional Sofa" })).toBeVisible();
  await expect(cards.filter({ hasText: "Globus China" })).toBeVisible();

  // 4. Owner uploads the two sofa screenshots (one per option)
  for (const [title, colour] of [[/Lunavelle/, "#e8dcc8"], [/Globus/, "#d9d4cc"]] as const) {
    await openOption(o, title);
    await o.getByTestId("photo-adder-input").setInputFiles(await fakeScreenshot(o, String(title), colour));
    await expect(o.getByTestId("gallery-photo")).toHaveCount(1, { timeout: 30_000 });
  }

  // 5. Links are recorded on each option
  await openOption(o, /Lunavelle/);
  await expect(o.getByRole("link", { name: "Open listing" })).toHaveAttribute("href", /cassahaus\.com\/products\/lunavelle-boucle-sectional-sofa/);
  // 7. Observed price recorded and flagged as unverified
  await expect(o.getByTestId("option-price")).toHaveText("S$550.00");
  await expect(o.getByText(/may be the starting price for a smaller configuration/)).toBeVisible();
  await openOption(o, /Globus/);
  await expect(o.getByRole("link", { name: "Open listing" })).toHaveAttribute("href", /globus-china\.com\/products\/174015/);
  await expect(o.getByTestId("option-price")).toHaveText(/1,462 \(currency not confirmed\)/);

  // 11. Neither option contributes to approved commitments
  await expectBudget(o, { "approved-commitments": "S$0.00", "actual-paid": "S$0.00", outstanding: "S$0.00" });

  // Invite Keith
  await o.goto("/more/household");
  await o.fill("#inv-name", "Keith");
  await o.fill("#inv-email", KEITH.email);
  await o.getByRole("button", { name: "Save invitation" }).click();
  await expect(o.getByText(/Invitation saved/)).toBeVisible();

  // 8–9. Keith logs in separately, sees the same options and comments
  const keith = await newPhone(browser);
  const k = keith.page;
  await signUp(k, KEITH.email, KEITH.password);
  await k.waitForURL((u) => u.pathname === "/");
  await openSofa(k);
  await expect(k.getByTestId("option-card")).toHaveCount(2);
  await openOption(k, /Lunavelle/);
  await expect(k.getByTestId("gallery-photo")).toHaveCount(1);
  await k.fill("#comment-body", "Love the bouclé, but is it deep enough with the island behind?");
  await k.getByRole("button", { name: "Post comment" }).click();
  await expect(k.getByTestId("comment")).toContainText("deep enough");
  await k.getByRole("button", { name: "Love it" }).click();
  await expect(k.getByRole("button", { name: "Love it" })).toHaveAttribute("aria-pressed", "true");
  // 20. Keith cannot give final approval
  await expect(k.getByText("The owner makes the final approval.")).toBeVisible();
  await expect(k.getByRole("button", { name: /^Approve/ })).toHaveCount(0);

  // 10. Owner compares the two options (sees Keith's comment and vote)
  await o.goto("/shop");
  await openSofa(o);
  await o.getByRole("link", { name: /Compare 2/ }).click();
  await expect(o.getByTestId("compare-cards").locator("article")).toHaveCount(2);
  await expect(o.getByTestId("compare-cards")).toContainText("Love it");

  // 12–13. Owner approves CassaHaus: only it counts
  await o.getByTestId("compare-cards").locator("article").filter({ hasText: "Lunavelle" }).getByRole("button", { name: "Approve" }).click();
  await expect(o.getByText(/Approved\. Its cost now counts as committed/)).toBeVisible();
  await expectBudget(o, { "approved-commitments": "S$550.00", "actual-paid": "S$0.00", outstanding: "S$550.00", "remaining-committed": "S$49,450.00" });

  // 14–16. Partial deposit: paid rises by the deposit only; outstanding adjusts
  await openSofa(o);
  await o.getByRole("link", { name: "Record payment" }).click();
  await o.fill("#amount", "200");
  await o.getByRole("button", { name: "Save payment" }).click();
  await expect(o.getByText("Payment recorded")).toBeVisible();
  await expectBudget(o, { "approved-commitments": "S$550.00", "actual-paid": "S$200.00", outstanding: "S$350.00", "remaining-committed": "S$49,450.00" });

  // 17. Switch to Globus — confirm its currency first (it cannot be approved without one)
  await openOption(o, /Globus/);
  await o.getByRole("button", { name: "Approve instead" }).click();
  await expect(o.getByText("Confirm the price currency before approving")).toBeVisible();
  await o.selectOption("#currency", "CNY");
  await o.getByRole("button", { name: "Save details" }).click();
  await expect(o.getByText("Saved")).toBeVisible();
  await o.goto("/budget/rates");
  await o.fill("#rate", "0.185");
  await o.fill("#source", "Manual (e2e)");
  await o.getByRole("button", { name: "Save rate" }).click();
  await expect(o.getByText("Rate saved")).toBeVisible();
  await openOption(o, /Globus/);
  await o.getByRole("button", { name: "Approve instead" }).click();
  await expect(o.getByText(/Approved\. Its cost now counts as committed/)).toBeVisible();

  // 18. Old approval superseded without double counting. 1462 CNY × 0.185 = S$270.47.
  //     The S$200 deposit stays in "paid" and shows as paid towards a replaced choice.
  await expectBudget(o, {
    "approved-commitments": "S$270.47",
    "actual-paid": "S$200.00",
    outstanding: "S$270.47",
    "replaced-spend": "S$200.00",
    "remaining-committed": "S$49,529.53",
  });
  await openSofa(o);
  await expect(o.getByTestId("approved-panel")).toContainText("Globus China sofa");
  await expect(o.getByText(/superseded/)).toBeVisible();

  // 19. Persists after refresh and logging in again
  await o.goto("/more");
  await o.getByRole("button", { name: "Sign out" }).click();
  await o.waitForURL(/login/);
  await signIn(o, OWNER.email, OWNER.password);
  await expectBudget(o, { "approved-commitments": "S$270.47", "actual-paid": "S$200.00", outstanding: "S$270.47" });
  await o.reload();
  await expect(o.getByTestId("approved-commitments")).toHaveText("S$270.47");

  // 20. Keith still cannot approve, and sees the owner's decision
  await openOption(k, /Lunavelle/);
  await expect(k.getByRole("button", { name: /^Approve/ })).toHaveCount(0);
  await expect(k.getByTestId("comment")).toContainText("deep enough");
  await k.goto("/budget");
  await expect(k.getByRole("link", { name: "Record payment" })).toHaveCount(0);
  await expect(k.getByTestId("approved-commitments")).toHaveText("S$270.47");

  await owner.ctx.close();
  await keith.ctx.close();
});
