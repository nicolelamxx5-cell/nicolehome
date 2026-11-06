# Using the app in Guangzhou & Foshan (10–15 Nov 2026)

## Short version

1. **Use your Singapore SIM on roaming data (or a Hong Kong / international travel eSIM).** This is the single most reliable option.
2. **Before you fly, open the app on Wi-Fi in Singapore**: sign in, open Add, the Trip guide and each destination you plan to visit. Your phone then keeps a copy for offline use.
3. If a page won't load, **keep shopping**: open **Add**, take photos or screenshots, and save. They are stored on the phone and upload by themselves when you're back online.

## Why

Mainland China filters international internet traffic (the "Great Firewall").
How the parts of this app are affected:

| Part | Where it runs | Mainland China access |
|---|---|---|
| App pages | Vercel | `*.vercel.app` addresses are commonly blocked. A **custom domain** on Vercel is often reachable but can be slow or intermittent. Not guaranteed. |
| Database, sign-in, photos | Supabase (Singapore region) | `*.supabase.co` access from mainland networks is inconsistent. Supabase's custom-domain add-on can help. Not guaranteed. |
| Fonts | Self-hosted with the app | Not affected (no Google Fonts requests at runtime). |
| Maps | Amap (高德), Baidu, Apple Maps links | Work in China. Google Maps is not used. |
| Screenshot reading (optional) | Anthropic API, called from the server | Not affected (the server is outside China). Your phone never calls it directly. |
| Exchange rates | frankfurter.app, called from the server | Not affected. |

**Roaming data** from a Singapore SIM (Singtel, StarHub, M1, etc.) is normally routed back through your
home operator, so it usually behaves like a Singapore connection and avoids the filtering. Most
Hong Kong and international travel eSIMs do the same. **Hotel Wi-Fi and mainland SIM cards do
not**, and the app may not load on them. Confirm the roaming arrangement with your operator
before travelling.

The app contains no Google services, analytics, ads or third-party trackers, which removes the most
common causes of "page hangs in China".

## Recommended hosting (decision)

* Supabase project in **Singapore (`ap-southeast-1`)**: closest to both Singapore and southern China.
* App on **Vercel with your own domain** (for example `home.yourname.com`), not a `*.vercel.app` address.
* Optional: Supabase **custom domain** (paid add-on) so the API isn't on `*.supabase.co`.
* Hosting inside mainland China needs an ICP licence, which isn't practical for a private household app.
  If roaming ever proved insufficient, the next step would be hosting the app in Hong Kong (no ICP
  needed), for example on a small VPS. The code runs anywhere Node.js runs.

**Before the trip, test the real thing.** Online China reachability checkers (for example sites that
test a URL from several mainland cities) give a quick signal. A friend in China opening the link is
better still. We could not test from inside mainland China while building this, so this has **not been
verified**.

## Offline: what works and what doesn't

Implemented and tested (automated test in emulated Chromium; see `tests/e2e/capture.spec.ts`):

| Works offline | Notes |
|---|---|
| **Adding products** (photos, screenshots, link, price) to an existing or **new** item | Saved in the phone's storage (IndexedDB). Shown as "N captures waiting to upload". |
| Automatic upload when the connection returns | Starts on reconnect, every 60 seconds, or with "Send now". |
| Pages you opened before (rooms, items, options, trip destinations, budget) | Shown as they were when last loaded; the banner says you're offline. |
| Product photos you viewed before | Cached on the phone (up to ~400). |

Needs a connection:

* Comments, votes, approvals, payments, edits to details, the import, and the export.
* Pages you have never opened on this phone.
* Screenshot reading and link titles.

**How syncing stays safe:** every capture gets its IDs on the phone before it's saved. If an upload
is interrupted and retried, the same records are updated rather than duplicated (covered by
tests). Photos are uploaded to fixed file names for the same reason. Nothing that changes money
(approvals, payments) is queued offline, so those can never be applied twice or out of order.

**Privacy on the phone:** cached pages and photos stay on that device only. Signing out clears them.

## Phone-specific notes

* **Android (Chrome):** install the app (menu → *Add to Home screen*). Then you can **share photos
  or links from Taobao, Xiaohongshu, Photos, etc. straight into 661C Home**, which opens Add with
  them filled in.
* **iPhone (Safari):** add to Home Screen from the Share menu. iOS does **not** let web apps
  appear in the share sheet, so on iPhone take screenshots and pick them in **Add → Screenshots**.
  Choosing several at once makes one option per screenshot (or one product with several photos).
* The offline behaviour above was tested in Chromium. Safari on iOS supports the same features
  (service workers, IndexedDB), but **test on your own iPhone before the trip**: open Add, turn on
  Airplane Mode, save a screenshot, turn Airplane Mode off, and check it appears.
