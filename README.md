# AniWatch

AniWatch is now a full-stack anime web app with account sync, profile customization, personalized lists, advanced player preferences, offline downloads, ad monetization, and PayPal Premium subscriptions.

## Stack

- Frontend: existing vanilla JavaScript catalog/player UI plus `src/fullstack.js`
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Auth: bcrypt password hashing + signed JWT session in an HttpOnly cookie
- Offline: Service Worker + Cache Storage + IndexedDB metadata
- Payments: PayPal Subscriptions REST API + verified webhooks
- Ads: configurable Adsterra display zones, hidden for active Premium accounts

## Features

### Authentication and profiles

Users can sign up, log in, log out, upload an avatar, change display name, choose default audio/subtitle preferences, and synchronize UI/player preferences. Session tokens are stored in HttpOnly SameSite cookies rather than browser-accessible local storage.

### Continue watching

Each episode gets a stable progress key. The player syncs progress periodically, on pause, on completion, and on page exit. Opening the same episode on another signed-in device automatically resumes the saved timestamp.

### Offline downloads

The service worker stores supported direct video files or HLS manifests and segments in Cache Storage, while IndexedDB stores the download library. HLS/offline support still depends on the upstream media host permitting browser CORS requests and the browser having enough quota. DRM-protected or header-restricted sources are not bypassed.

### Player customization

Signed-in preferences include playback speed, subtitle font/color/background/opacity, intro/outro lengths, auto-skip toggles, accent color, theme, and layout density.

Hotkeys:

- Space / K: play or pause
- Left / Right: seek 10 seconds
- M: mute
- F: fullscreen
- [ / ]: slower/faster playback

### Personalized lists

Accounts start with Plan to Watch and Favorites. Users can create additional folders, make them public or private, add the currently selected anime, and share public list URLs.

### Monetization

Free users can see configured ad placements. Premium accounts are ad-free.

PayPal Premium uses your own PayPal developer application credentials. AniWatch can create the product/plan automatically on first checkout when `PAYPAL_AUTO_SETUP=true`, or you can provide an existing `PAYPAL_PLAN_ID`.

No PayPal email address or payment destination is hard-coded into this repository. Money is received by the PayPal merchant account associated with the live `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

## Environment

Copy `.env.example` into your deployment environment and set secrets there. Source edits are not required.

Required:

```
DATABASE_URL=postgresql://...
JWT_SECRET=<at least 32 random characters>
APP_URL=https://your-domain.example
```

PayPal:

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_PLAN_ID=
PAYPAL_AUTO_SETUP=true
PAYPAL_SUBSCRIPTION_PRICE=4.99
PAYPAL_CURRENCY=USD
```

For production, change `PAYPAL_ENV=live` and use the live app credentials belonging to the PayPal merchant account that should receive subscription payments.

Register a PayPal webhook pointing to:

```
https://your-domain.example/api/paypal/webhook
```

Subscribe it to billing subscription lifecycle events, including activated, suspended, cancelled, and expired.

Ads:

```
ADS_ENABLED=true
ADSTERRA_HEADER_KEY=...
ADSTERRA_RECTANGLE_KEY=...
ADSTERRA_SIDEBAR_KEY=...
```

If an ad key is empty, that slot stays hidden. Active Premium users receive runtime config with ads disabled.

## Local development

A PostgreSQL database is required.

```sh
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

## Docker deployment

```sh
docker compose up --build
```

Before production, set at least `POSTGRES_PASSWORD`, `JWT_SECRET`, and `APP_URL`, plus the PayPal/ad credentials you intend to use.

## Render deployment

`render.yaml` defines the web service and PostgreSQL database. Create a Blueprint from this repository, provide the fields marked `sync: false`, deploy, then update `APP_URL` to the final HTTPS service URL.

## Database migrations

Production startup runs:

```sh
npx prisma migrate deploy
```

The initial migration is committed under `prisma/migrations`.

## Tests

```sh
npm test
```

The GitHub Actions CI workflow installs dependencies and runs the existing provider/streaming tests on pushes and pull requests.

## Important deployment note

GitHub Pages cannot host this version because Pages is static-only and cannot run the authentication, database, PayPal webhook, or progress-sync server. Deploy the full-stack app with Docker/Render or another Node.js host.
