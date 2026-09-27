# AniWatch — GitHub Pages Edition

AniWatch is a static anime frontend designed to deploy on **GitHub Pages**. The website itself does not require a Node server, Docker, Render, Prisma, or a private server.

The app keeps the existing anime catalog/streaming integrations and adds optional cloud features through Supabase:

- email/password accounts
- profile avatars and display names
- default audio/subtitle preferences
- cross-device Continue Watching sync
- custom public/private watch lists
- theme, accent color, density, subtitle styling, playback speed, and intro/outro preferences
- browser offline downloads through Service Worker + Cache Storage + IndexedDB
- Adsterra ad placements for free accounts
- PayPal subscription checkout with server-side verification through a Supabase Edge Function

## Important architecture

GitHub Pages is static hosting. It cannot run Express, PHP, Python, Prisma, or other server-side code.

The site is hosted on GitHub Pages. Supabase is used only as the managed authentication/database/storage API needed for synced user accounts. Supabase Row Level Security protects each user's rows when the publishable browser key is used.

If Supabase is not configured, the public anime browser/player and offline storage still work, but cloud accounts and cross-device sync stay disabled.

## 1. Enable GitHub Pages

This repository includes:

```
.github/workflows/pages.yml
```

In GitHub open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

After a push to `main`, the workflow deploys the site.

Expected project URL:

```
https://brysona320-coder.github.io/AniWatch/
```

## 2. Create a Supabase project

Create a Supabase project, then open **SQL Editor** and run the complete contents of:

```
supabase/schema.sql
```

That creates:

- `profiles`
- `watch_progress`
- `watch_lists`
- `list_items`
- `subscriptions`
- the `avatars` Storage bucket
- Row Level Security policies
- the new-user trigger that creates a profile, Plan to Watch list, and Favorites list

In Supabase Auth settings, add the GitHub Pages URL as an allowed site/redirect URL:

```
https://brysona320-coder.github.io/AniWatch/
```

## 3. Add GitHub repository variables

In this repository open:

**Settings → Secrets and variables → Actions → Variables**

Create these variables:

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
PAYPAL_CLIENT_ID
PAYPAL_PLAN_ID
PAYPAL_PRICE
PAYPAL_CURRENCY
ADSTERRA_HEADER_KEY
ADSTERRA_RECTANGLE_KEY
ADSTERRA_SIDEBAR_KEY
```

Only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are required for accounts.

The Supabase **publishable key is intended for browser use** when RLS is configured. Never put a Supabase service-role/secret key into GitHub Pages or repository variables used to build the page.

The Pages workflow creates `src/runtime-config.js` during deployment from these variables. No source-code edits are required.

## 4. PayPal Premium

The static site uses PayPal's JavaScript subscription button. The browser receives only:

```
PAYPAL_CLIENT_ID
PAYPAL_PLAN_ID
```

Do **not** expose a PayPal Client Secret in GitHub Pages.

Create a PayPal subscription product/plan in the PayPal developer/business dashboard and put its public plan ID into `PAYPAL_PLAN_ID`.

Example optional display values:

```
PAYPAL_PRICE=4.99
PAYPAL_CURRENCY=USD
```

The configured PayPal app/plan determines the actual recurring charge. The display price should match the PayPal plan.

### Secure Premium verification

The repository contains:

```
supabase/functions/paypal-subscription/index.ts
```

Deploy that function to your Supabase project with JWT gateway verification disabled because it accepts both PayPal webhooks and signed-in browser verification requests. The function verifies the browser's Supabase token itself.

Using the Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy paypal-subscription --no-verify-jwt
```

You can also create/deploy the function through Supabase Dashboard → Edge Functions.

Set these **Supabase Edge Function secrets**, not GitHub Pages variables:

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_PLAN_ID=...
PAYPAL_WEBHOOK_ID=...
APP_ORIGIN=https://brysona320-coder.github.io
```

Supabase automatically supplies its own project URL/keys to Edge Functions.

For real payments, use the matching live PayPal application and live plan. Account eligibility and identity requirements are controlled by PayPal and should not be bypassed.

### PayPal webhook

In the PayPal developer dashboard, create a webhook pointing to:

```
https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/paypal-subscription
```

Enable at least:

```
BILLING.SUBSCRIPTION.ACTIVATED
BILLING.SUBSCRIPTION.SUSPENDED
BILLING.SUBSCRIPTION.CANCELLED
BILLING.SUBSCRIPTION.EXPIRED
```

Copy the resulting webhook ID into the Supabase Edge Function secret `PAYPAL_WEBHOOK_ID`.

Premium is only enabled after the Edge Function verifies the PayPal subscription. A visitor cannot unlock Premium merely by changing browser storage.

## 5. Ads

Create Adsterra zones and add their public zone keys to GitHub repository variables:

```
ADSTERRA_HEADER_KEY
ADSTERRA_RECTANGLE_KEY
ADSTERRA_SIDEBAR_KEY
```

Blank zones stay hidden. Accounts whose verified Supabase profile has `is_premium = true` do not render the configured ad slots.

## 6. Offline downloads

The Service Worker caches supported direct media or HLS manifests/segments in browser Cache Storage and tracks the download library in IndexedDB.

Offline downloading depends on:

- the upstream video host allowing CORS/browser fetches
- the browser having enough storage quota
- the media not requiring unsupported request headers or DRM

AniWatch does not bypass DRM, authentication headers, or source restrictions.

## 7. Run locally

Because this is a static site:

```sh
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000
```

The committed `src/runtime-config.js` is intentionally blank for local/public safety. GitHub Actions replaces it in the deployed artifact using repository variables.

## Tests

```sh
npm test
```

These tests cover the existing provider and streaming adapters.
