# 661C Home Hub — Implementation Plan

## 1. What was inspected

* Project folder: empty git repository (no existing code to preserve).
* Workbook `661C_Whole_House_Renovation_China_Sourcing_Tracker.xlsm` (16 sheets):
  * 13 room sheets, all with the identical 23-column layout (`ID`, `Category`,
    `Item / Specification`, `Priority`, `Source Decision`, `Supplier / Brand`,
    `Model / SKU`, `Qty`, `Unit`, `Est. Unit (SGD)`, `Est. Total`,
    `Quoted Unit (SGD)`, `Quoted Total`, `Ordered Unit (SGD)`, `Committed Total`,
    `Paid to Date (SGD)`, `Balance to Pay`, `Status`, `Purchase By`,
    `Reference URL`, `Photo / File Link`, `Dimensions / Finish`,
    `Notes / Compliance`), header on row 4, data from row 5.
  * 193 item rows with unique IDs `01-001` … `13-013` (prefix = sheet).
  * `Dashboard` — formulas only (no inputs). Used only to reconcile totals.
  * `Payments` — header on row 3, currently empty.
  * `Sourcing Guide` — 15 category → preferred-source rules.
  * No Guangzhou/Foshan trip sheet in this version of the workbook.
  * Only 4 rows currently carry estimates/suppliers (Bosch oven, Tefal rice
    cooker, Ninja air fryer, Wells water dispenser). One row (`05-020`) has a
    hard-coded `Est. Total` instead of the formula; two rows have supplier
    `NIL`.
  * Likely overlaps found between sheets (reported for review, not merged):
    `12-002` Bathroom doors vs `10-019` / `11-019`; `12-004` Window grilles vs
    `06-010`; `13-010` Extinguishers vs `05-025`; `01-022` Aircon system vs
    `07-015` Bedroom aircon; `01-021` Ceiling fans; `01-019` Downlights vs
    room lighting rows.

## 2. Architecture (chosen defaults)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript), Cache Components **off** | Every page is per-user; classic dynamic rendering is simpler and safer. |
| Styling | Tailwind CSS v4, custom design tokens | Calm ivory/greige/champagne palette. |
| Database | Supabase Postgres, SQL migrations in `supabase/migrations` | Real constraints, RLS, transactional RPCs. |
| Auth | Supabase email + password | Works on phones and in an installed PWA (magic links often open the wrong browser). |
| Files | Private Supabase Storage bucket, short-lived signed URLs | Screenshots and receipts are never public. |
| Writes | Server Actions with the user's own session (RLS applies), plus `security definer` RPCs for multi-row state changes (approve / supersede / cancel) | One transaction per approval switch, so a commitment can't be counted twice. |
| Money | Integer cents in TypeScript, `numeric` in Postgres, FX snapshot stored on each approval and payment | Historical costs don't drift when rates move. |
| Tests | Vitest (finance, import, requirements), integration tests against a local Supabase stack (RLS, storage), Playwright (acceptance flow, mobile viewport, offline queue) | |
| Hosting | Vercel (Singapore-adjacent edge) + Supabase project in `ap-southeast-1` (Singapore) with a custom domain | See `docs/CHINA_ACCESS.md`. |

## 3. Entities and relationships

```
households 1─* household_members (role owner|member + permission flags) *─1 auth.users
households 1─* household_invites (email → role)
households 1─* rooms 1─* required_items 1─* product_options 1─* option_images
                                   │                    ├─* option_comments
                                   │                    ├─* option_preferences (one per user)
                                   │                    └─* option_checks (requirements)
                                   ├─* approvals (≤1 active per item; history kept)
                                   └─* payments (linked to approval/item; deposits, balances, refunds)
households 1─* suppliers 1─* product_options
households 1─* budget_categories ─* required_items
households 1─* exchange_rates (currency, rate→SGD, date, source, manual flag)
households 1─* shared_costs (e.g. container freight; allocated, counted once)
households 1─* shopping_locations *─* required_items (location_items, no budget impact)
households 1─* documents (receipts, warranty docs, quotes) → storage
households 1─* sourcing_guidelines (imported from Sourcing Guide sheet)
households 1─* import_batches (report JSON: created / updated / conflicts / review)
households 1─* audit_log (trigger-written: who, what, when, diff)
```

Key constraints:

* `unique (household_id, legacy_id)` on `required_items` — re-importing the
  workbook updates rows instead of duplicating them.
* Partial unique index: only one `approvals.status = 'active'` per required item.
* `product_options.status` can only reach `approved` / `ordered` through the
  approval RPCs (enforced by trigger), so Keith cannot bypass the UI.
* Payments: `amount > 0`, direction given by `kind` (`refund` is negative).

## 4. Financial definitions (implemented in `src/lib/finance.ts`)

* **Total budget** — household budget set by the owner.
* **Approved commitments** — sum of the SGD cost snapshot of each *active*
  approval + committed shared costs. Shortlisted options never count.
* **Actual paid** — sum of all payments in SGD (refunds subtract).
* **Outstanding** — per active approval, `max(0, snapshot − net paid on it)`.
* **Spent on replaced choices** — net payments on superseded or cancelled
  approvals (e.g. a lost deposit). Shown separately and included in
  committed spend, never added on top of the active commitment.
* **Forecast final cost** — per required item: active approval snapshot, else
  the item allowance (workbook estimate), else the highest-priced shortlisted
  option with a known currency (a cautious figure), else nothing (and the item
  is listed as "no estimate yet"). Spending on replaced choices, shared costs
  and contingency are added on top.
* **Remaining** is always shown with its basis: "vs commitments" and
  "vs forecast".

## 5. Screens and navigation

Bottom navigation (mobile) / side rail (desktop): **Home · Shop · Wishlist · Budget · More**, with a floating **Add** button for capture.

* **Home** — what needs a decision, recent captures, budget at a glance, trip countdown.
* **Shop** — rooms → room (required items) → item (option cards, compare, approve) → option detail.
  Trip guide (Guangzhou/Foshan destinations) and Sourcing guide live here.
* **Add (capture)** — screenshots / photo / link → room → item → save. Works offline (queued).
* **Wishlist** — Pinterest-style grid of every option, filtered by status.
* **Budget** — the five totals with definitions, per-room and per-category breakdown, payments, exchange rates, shared costs; every figure drills down to records.
* **More** — approvals history, warranties, suppliers, import/export, household & permissions, activity log.

## 6. Missing inputs (none block development)

* Supabase project URL + keys (for deployment) — `.env.example` lists them.
* Optional `ANTHROPIC_API_KEY` for screenshot extraction; without it the
  feature is hidden and manual entry works.
* Keith's email address (entered in the app by the owner).
* The two sofa screenshots (uploaded by the owner; the app never substitutes photos).
* Verified addresses for the trip destinations (names are stored; addresses
  only once verified; map links search by Chinese name).

## 7. Risks

* **Mainland China access** — see `docs/CHINA_ACCESS.md`. Main mitigation: use
  Singapore roaming data or an eSIM that routes through Hong Kong or Singapore,
  plus an offline capture queue.
* **iOS share sheet** — iOS Safari doesn't support the Web Share Target API.
  Android Chrome (installed PWA) does. On iPhone the user picks screenshots
  from Photos in the Add screen.
* **URL metadata** — Taobao/Pinduoduo/1688/Xiaohongshu block scraping; the app
  tries Open Graph tags with a short timeout and always falls back to manual.
* **Workbook macros/formulas** — not preserved; export produces a fresh workbook from the database.

## 8. Milestones

1. Foundation — shell, design system, auth, household, invites, permissions, DB, storage.
2. Shopping — rooms, items, options, multi-screenshot capture, links, wishlist, comparison.
3. Approvals & budget — approval RPCs, payments, FX, dashboard with drill-down.
4. Smart assistance — warranties, requirement library + checks, ready-to-order gate, sourcing recommendation.
5. Travel & import — workbook import/export, trip guide, location checklists, PWA/offline.

See `docs/STATUS.md` for what is complete and verified.
