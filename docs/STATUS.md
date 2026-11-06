# Status — 6 Nov 2026

Everything below was verified by automated tests against a **real local Supabase stack**
(Postgres, Auth, Storage, RLS) and a **production build** of the app. The browser tests ran on
Chromium with **emulated iPhone 13** screen, touch and user agent, not a physical phone.

## Test results

| Suite | What it covers | Result |
|---|---|---|
| Unit (`tests/unit`, 31) | Finance: two options for one item, replacing an approval, deposit + balance, currency conversion and rounding, refunds, cancelled orders, shared-freight allocation, unapproved wishlist options, reconciliation of totals. Import parsing/planning: duplicate prevention, app-edit conflicts, Payments tab vs cumulative paid. Requirements readiness, sourcing suggestions. Also the real workbook (when `WORKBOOK_PATH` is set). | ✅ all pass |
| Integration (`tests/integration`, 17) | Database-enforced permissions: Keith can't approve, pay, change budgets or grant himself rights. Strangers see nothing. Private storage (no public URLs). One active approval per item enforced. Switching supersedes. Rate changes don't move approved snapshots. Ordering blocked by critical checks without an override. Owner can later grant Keith approval rights. Audit log records the actor. Re-sent captures don't duplicate. | ✅ all pass |
| End-to-end (`tests/e2e`, 5) | The 20-step sofa acceptance test from the brief. Three screenshots → three options. Offline capture → automatic upload on reconnect. Android share target. Real-workbook import + re-import + Excel export. | ✅ all pass |

## Milestones

| Milestone | State |
|---|---|
| 1 Foundation (shell, design, auth, household, invites, permissions, DB, private storage) | **Done** |
| 2 Shopping (rooms, items, options, multi-screenshot capture, links, wishlist, comparison) | **Done** |
| 3 Approvals & budget (Keith's review rights, approvals, payments, dashboard, currencies) | **Done** |
| 4 Smart assistance (warranties, requirement library, checks with evidence, ready-to-order gate, China/SG suggestions) | **Done** |
| 5 Travel & import (workbook import, trip guide, location checklists, Excel export, PWA/offline) | **Done** |

## Your data

* The workbook was inspected and imports as **13 rooms, 193 items, 15 sourcing guidelines, 4 named
  candidate products** (Bosch oven, Tefal rice cooker, Ninja air fryer, Wells water dispenser) and **0
  payments** (the Payments sheet is empty). Forecast after import: **S$7,977.00**. Approved: **S$0**.
* **6 possible overlaps** between house-wide and room sheets are flagged for review (11 rows): aircon
  system vs bedroom aircon, bathroom doors ×2, window grilles, extinguishers, and island vs door
  handles. Nothing is merged automatically.
* Row 03-005 "Cream upholstered sofa" is the **Main sofa**, with the CassaHaus (S$550, flagged as
  possibly a smaller configuration) and Globus China (1,462, **currency not confirmed**) options.
  Both are shortlisted, neither approved, and 8 sofa checks are attached (dimensions, chaise side,
  island layout, lift/door access, fabric, frame, warranty, final price).
* The workbook file is **not committed** to the repository.

## Not done / not verified (honest list)

* **Not yet deployed.** Deploying needs your Supabase project and Vercel account (see `DEPLOYMENT.md`).
* **Mainland China reachability is not verified.** It can only be tested from a mainland connection.
  The recommended setup (Singapore roaming data) is explained in `CHINA_ACCESS.md`.
* **Not tested on a physical iPhone or Android phone**, or in real Safari/WebKit. Please do the
  2-minute Airplane Mode check in `CHINA_ACCESS.md` on both phones before the trip.
* **Screenshot reading** (`ANTHROPIC_API_KEY`) is implemented, but wasn't exercised end-to-end
  here because no API key was available. Without a key, the feature is hidden and everything else works.
* **Link titles** come from the page's own title where the site allows it. Taobao/Pinduoduo/1688
  usually block this; you then type the name yourself.
* **Supplier records** are created from the names you type on options and the import. There's no
  separate supplier edit form yet (the WeChat/contact field lives on each option).
* **Receipt / warranty documents** are stored as photos on the option. PDF upload isn't wired up yet
  (the storage bucket accepts PDFs).
* **Trip addresses** are intentionally empty until you verify them. Map buttons search by Chinese name.
* Comments and changes from the other person appear on the next page load. There are no live push updates.
