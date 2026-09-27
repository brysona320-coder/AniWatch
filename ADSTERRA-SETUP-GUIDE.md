# Monetization setup

AniWatch supports two independent revenue paths:

1. Display advertising for free accounts.
2. An optional PayPal Premium subscription that disables ads.

## PayPal Premium

Create a PayPal developer application for the merchant account that should receive subscription payments. Put its credentials into deployment environment variables:

```
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_AUTO_SETUP=true
PAYPAL_SUBSCRIPTION_PRICE=4.99
PAYPAL_CURRENCY=USD
```

Use sandbox credentials while testing. When ready for real payments, switch `PAYPAL_ENV` to `live` and replace the credentials with the live credentials for that same merchant account.

When `PAYPAL_AUTO_SETUP=true` and `PAYPAL_PLAN_ID` is empty, the server creates the PayPal product and monthly billing plan automatically on the first checkout and stores the plan ID in the database.

Configure the PayPal webhook URL as:

```
https://YOUR-DOMAIN/api/paypal/webhook
```

The server verifies PayPal webhook signatures before changing a user's Premium status.

## Adsterra slots

Create your website and ad zones in the Adsterra publisher dashboard, then provide the zone keys as environment variables:

```
ADS_ENABLED=true
ADSTERRA_HEADER_KEY=...
ADSTERRA_RECTANGLE_KEY=...
ADSTERRA_SIDEBAR_KEY=...
```

No source-code edit is needed. Empty keys keep those placements hidden.

Ad revenue payout details, thresholds, supported payment methods, and eligibility are controlled by your ad-network account and may change over time; check the publisher dashboard for the current terms.

## Premium behavior

An account becomes ad-free only after the backend receives and verifies an active PayPal subscription event. Cancelling, suspending, or expiring the subscription updates the stored account status through PayPal webhooks.
