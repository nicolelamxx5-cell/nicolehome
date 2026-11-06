# Deployment

You need a **Supabase** project (database, sign-in, private photo storage) and a **Vercel**
project (the app). Both have free tiers. The Supabase Pro plan adds daily backups. It's
recommended once real money is tracked here.

## 1. Supabase

1. Create a project at supabase.com. **Region: Southeast Asia (Singapore)**. Save the database password.
2. Apply the migrations from your computer:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

   ```bash
   npx supabase db push
   ```

   This creates all tables, security rules (RLS), workflow functions and the private
   `household-files` storage bucket.
3. **Authentication → Providers → Email**: keep Email enabled and turn **Confirm email** on.
4. **Authentication → URL Configuration**: set *Site URL* to your app address (for example
   `https://home.example.com`) and add `https://home.example.com/auth/confirm` to the redirect URLs.
5. **Settings → API**: copy the *Project URL* and the *publishable* key (or legacy *anon* key).
   Never put the *secret / service_role* key in the app.

## 2. Vercel

1. Import this GitHub repository in Vercel (framework: Next.js; defaults are fine).
2. Environment variables (see `.env.example`):
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `NEXT_PUBLIC_SITE_URL` (your app address)
   * `ANTHROPIC_API_KEY` (optional): enables "Read details from screenshot". Leave it unset to hide the feature.
3. Add your **own domain** under *Settings → Domains*. This matters for access from China; see `CHINA_ACCESS.md`.
4. Deploy.

## 3. First use

1. Open the app and **create an account**. The first account creates the household and becomes the
   owner. Every later account can only join by invitation.
2. Import your workbook: **More → Import workbook**.
3. **More → People & permissions**: invite Keith by email. He creates an account with that email and
   joins automatically as a member: he can view, add, shortlist, vote and comment, but not approve or pay.
4. Once both accounts exist, in Supabase **turn off "Allow new users to sign up"**
   (Authentication → Providers → Email). Even without this, a stranger who signs up sees nothing:
   all data is protected by row-level security. Turning it off simply prevents stray accounts.

## Backups and export

* **More → Export to Excel** downloads everything: room sheets in the workbook layout, plus options,
  approvals, payments, rates, checks, comments and the activity log. Do this regularly, for example weekly
  and before the trip.
* Supabase Pro includes daily database backups. On the free plan, you can also run
  `npx supabase db dump --data-only -f backup.sql` from your computer.
* Photos live in Supabase Storage (`household-files` bucket). Their file paths are included in the database.

## Local development and tests

Requirements: Node 22, Docker.

```bash
npm install
```

```bash
npx supabase start
```

```bash
npx supabase status -o env
```

Copy the API URL and anon key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. For the integration and end-to-end tests, also add
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

```bash
npm run dev
```

Tests:

```bash
npm test
```

```bash
npm run test:integration
```

```bash
npm run build && npm start
```

```bash
npm run test:e2e
```

`test:integration` and `test:e2e` **erase the local database**. They refuse to run against
anything other than `localhost` / `127.0.0.1`. To include the real-workbook tests, set
`WORKBOOK_PATH=/path/to/tracker.xlsm` (the workbook is never committed).

## Previews: reaching Supabase through the app

If the browser can't reach Supabase directly (for example a cloud preview where Supabase only runs
on the server's `127.0.0.1`), build and start with:

```bash
NEXT_PUBLIC_SUPABASE_PROXY=1 SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 npm run build
```

```bash
NEXT_PUBLIC_SUPABASE_PROXY=1 SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 npm start
```

Browser calls and photo links then go to `/supabase/*` on the app's own address, and Next.js
forwards them. In production on Vercel, leave both unset.
