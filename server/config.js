import crypto from "node:crypto";

function bool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const production = process.env.NODE_ENV === "production";
const jwtSecret =
  process.env.JWT_SECRET ||
  (production ? "" : crypto.randomBytes(48).toString("hex"));

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must contain at least 32 characters.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

export const config = Object.freeze({
  production,
  port: number(process.env.PORT, 3000),
  appUrl: trimSlash(process.env.APP_URL || "http://localhost:3000"),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret,
  cookieName: production ? "__Host-aniwatch_session" : "aniwatch_session",
  sessionDays: 7,
  paypal: {
    env: process.env.PAYPAL_ENV === "live" ? "live" : "sandbox",
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    webhookId: process.env.PAYPAL_WEBHOOK_ID || "",
    planId: process.env.PAYPAL_PLAN_ID || "",
    planName: process.env.PAYPAL_SUBSCRIPTION_NAME || "AniWatch Premium",
    price: number(process.env.PAYPAL_SUBSCRIPTION_PRICE, 4.99),
    currency: (process.env.PAYPAL_CURRENCY || "USD").toUpperCase(),
    autoSetup: bool(process.env.PAYPAL_AUTO_SETUP, true)
  },
  ads: {
    enabled: bool(process.env.ADS_ENABLED, true),
    provider: process.env.ADS_PROVIDER || "adsterra",
    headerKey: process.env.ADSTERRA_HEADER_KEY || "",
    rectangleKey: process.env.ADSTERRA_RECTANGLE_KEY || "",
    sidebarKey: process.env.ADSTERRA_SIDEBAR_KEY || ""
  }
});

export function publicConfig() {
  return {
    appUrl: config.appUrl,
    ads: {
      enabled: config.ads.enabled,
      provider: config.ads.provider,
      headerKey: config.ads.headerKey,
      rectangleKey: config.ads.rectangleKey,
      sidebarKey: config.ads.sidebarKey
    }
  };
}
