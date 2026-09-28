# AniWatch — GitHub Pages Edition

AniWatch is a static anime frontend hosted on **GitHub Pages**.

Features include email/password accounts through Supabase, profile avatars, Continue Watching sync, public/private lists, player customization, and browser offline downloads.

## Monetization

AniWatch is **ads-only**. There is no PayPal integration, Premium tier, subscription billing, or paid membership code.

The active publisher script is included directly in `index.html`:

```html
<script src="https://pl31543304.profitableratecpmnetwork.com/e7/8d/82/e78d820541c26ca920191a7d24b6e49d.js"></script>
```

That script URL is public publisher code, not a password or API secret.

Do not click your own advertisements or manufacture impressions/clicks. Follow the ad network's publisher rules.

## GitHub Pages

In the repository open:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

The workflow in `.github/workflows/pages.yml` deploys pushes to `main`.

Expected site URL:

```
https://brysona320-coder.github.io/AniWatch/
```

## Supabase accounts and sync

Supabase is optional for the public browser/player, but required for cloud accounts, avatars, cross-device Continue Watching, and synced lists.

Create a Supabase project and run:

```
supabase/schema.sql
```

in Supabase **SQL Editor**.

Then add these GitHub repository variables under:

**Settings → Secrets and variables → Actions → Variables**

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Add this URL to the allowed Supabase Auth site/redirect URLs:

```
https://brysona320-coder.github.io/AniWatch/
```

The publishable key is a browser-facing key. Never expose a Supabase service-role/secret key on GitHub Pages.

## Offline downloads

The Service Worker stores supported media in browser Cache Storage and tracks downloads with IndexedDB. Whether a video can be saved depends on the upstream host's CORS/access rules and browser storage quota.

## Tests

```sh
npm test
```

## Public API proxy across devices

GitHub Pages cannot host a server-side proxy. `worker/proxy.js` is a Cloudflare Worker for the site's AnimeParadise-compatible catalog and episode JSON requests. It restricts routes to the requests the app uses; it does not proxy video streams or provide an API service by itself.

1. In Cloudflare Workers, create a Worker and paste the contents of `worker/proxy.js`. Deploy it to a public `*.workers.dev` address (or a domain you control).
2. Add a Worker environment variable named `UPSTREAM_ORIGIN` set to the HTTPS **origin** of an AnimeParadise-compatible API you operate or are authorized to proxy. Use an origin such as `https://api.example.com/`, without an extra path, query string, or credentials.
3. Visit the Worker URL followed by `/search?q=test&limit=20`. It should return JSON; an unavailable upstream will return HTTP 502.
4. On the AniWatch site, open **API settings**, set the **AnimeParadise API URL** to the Worker URL, and save. The setting is stored only in that browser, so repeat this on other devices. To make the proxy the default for all devices, update `ANIMEPARADISE_DEFAULT` in both `src/providers.js` and `src/streaming.js` after deployment and remove or migrate any saved browser overrides.

A public hostname only solves addressability and browser CORS for the JSON API. It does not make an unavailable upstream work, remove upstream rate limits, or ensure video playback. The Worker permits the published Pages origin; CORS does not prevent non-browser clients from calling a public endpoint.
