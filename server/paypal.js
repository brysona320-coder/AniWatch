import crypto from "node:crypto";
import { config } from "./config.js";
import { prisma } from "./db.js";

function apiBase() {
  return config.paypal.env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured() {
  return Boolean(config.paypal.clientId && config.paypal.clientSecret);
}

async function accessToken() {
  if (!paypalConfigured()) {
    const error = new Error("PayPal is not configured.");
    error.status = 503;
    throw error;
  }
  const basic = Buffer.from(config.paypal.clientId + ":" + config.paypal.clientSecret).toString("base64");
  const response = await fetch(apiBase() + "/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error("PayPal authentication failed.");
  return (await response.json()).access_token;
}

async function paypal(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(apiBase() + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Content-Type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
      ...options.headers
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(body?.message || body?.details?.[0]?.description || "PayPal request failed.");
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return body;
}

async function cachedPlanId() {
  if (config.paypal.planId) return config.paypal.planId;
  return (await prisma.appConfig.findUnique({ where: { key: "paypal.planId" } }))?.value || "";
}

export async function ensurePlan() {
  const existing = await cachedPlanId();
  if (existing) return existing;
  if (!config.paypal.autoSetup) {
    const error = new Error("PAYPAL_PLAN_ID is not configured.");
    error.status = 503;
    throw error;
  }
  const product = await paypal("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: config.paypal.planName,
      description: "Premium AniWatch membership",
      type: "SERVICE",
      category: "SOFTWARE"
    })
  });
  const plan = await paypal("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: product.id,
      name: config.paypal.planName,
      description: "Ad-free AniWatch membership with premium account features.",
      status: "ACTIVE",
      billing_cycles: [{
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: config.paypal.price.toFixed(2), currency_code: config.paypal.currency } }
      }],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 3 }
    })
  });
  await prisma.appConfig.upsert({
    where: { key: "paypal.planId" },
    update: { value: plan.id },
    create: { key: "paypal.planId", value: plan.id }
  });
  return plan.id;
}

export async function createSubscription(user) {
  const planId = await ensurePlan();
  const subscription = await paypal("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      subscriber: {
        email_address: user.email,
        name: { given_name: user.displayName.slice(0, 140) || "AniWatch User" }
      },
      application_context: {
        brand_name: "AniWatch",
        locale: "en-US",
        user_action: "SUBSCRIBE_NOW",
        return_url: config.appUrl + "/?subscription=success",
        cancel_url: config.appUrl + "/?subscription=cancelled"
      }
    })
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { paypalSubscriptionId: subscription.id, subscriptionStatus: "APPROVAL_PENDING" }
  });
  return {
    id: subscription.id,
    approvalUrl: subscription.links?.find((link) => link.rel === "approve")?.href || null
  };
}

export async function cancelSubscription(user) {
  if (!user.paypalSubscriptionId) return;
  await paypal("/v1/billing/subscriptions/" + encodeURIComponent(user.paypalSubscriptionId) + "/cancel", {
    method: "POST",
    body: JSON.stringify({ reason: "Cancelled by AniWatch user." })
  });
}

function mapStatus(eventType, resource) {
  const direct = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
    "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
    "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
    "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED"
  }[eventType];
  if (direct) return direct;
  const value = String(resource?.status || "").toUpperCase();
  return ["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"].includes(value) ? value : null;
}

export async function verifyWebhook(headers, event) {
  if (!config.paypal.webhookId) {
    const error = new Error("PAYPAL_WEBHOOK_ID is not configured.");
    error.status = 503;
    throw error;
  }
  const result = await paypal("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: config.paypal.webhookId,
      webhook_event: event
    })
  });
  return result.verification_status === "SUCCESS";
}

export async function applyWebhook(event) {
  const resource = event?.resource || {};
  const subscriptionId =
    resource.id ||
    resource.billing_agreement_id ||
    resource.supplementary_data?.related_ids?.subscription_id;
  if (!subscriptionId) return;
  const status = mapStatus(event.event_type, resource);
  if (!status) return;
  const nextBilling = resource.billing_info?.next_billing_time;
  await prisma.user.updateMany({
    where: { paypalSubscriptionId: subscriptionId },
    data: {
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: nextBilling ? new Date(nextBilling) : null
    }
  });
}
