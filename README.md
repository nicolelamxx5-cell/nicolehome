# 661C Home Hub

A private, mobile-first renovation shopping and budget app for two homeowners renovating
661C Edgedale Plains. Save products from Taobao, 1688, Xiaohongshu, showrooms and Singapore
stores as screenshots or links, compare options room by room, approve one per item, and track
forecast, commitments and payments separately.

* **How to use it:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
* **Deploying (Supabase + Vercel):** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
* **China access & offline:** [docs/CHINA_ACCESS.md](docs/CHINA_ACCESS.md)
* **Plan, data model, decisions:** [docs/PLAN.md](docs/PLAN.md)
* **What's done and verified:** [docs/STATUS.md](docs/STATUS.md)

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres, Auth, private Storage,
row-level security) · Vercel · PWA (service worker, offline capture queue, Android share target).

## Layout

```
supabase/migrations/   schema, RLS & storage policies, approval workflow functions
src/lib/finance.ts     budget engine (exact cents) — the single source of every total
src/lib/import/        workbook parser + planner (duplicate-safe) + apply
src/lib/requirements.ts  purchase-check library and readiness rules
src/app/actions.ts     all writes (server actions, as the signed-in user)
src/app/(app)/         screens: Home, Shop, Add, Wishlist, Budget, More, Trip
public/sw.js           offline pages/photos + share target
tests/                 unit, integration (RLS against local Supabase), e2e (Playwright)
```

## Quick start (local)

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#local-development-and-tests).
