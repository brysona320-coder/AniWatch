import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") || "";
const PAYPAL_PLAN_ID = Deno.env.get("PAYPAL_PLAN_ID") || "";
const PAYPAL_ENV = Deno.env.get("PAYPAL_ENV") === "live" ? "live" : "sandbox";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "*";

const PAYPAL_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = APP_ORIGIN === "*" || origin === APP_ORIGIN ? origin || "*" : APP_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json"
    }
  });
}

async function paypalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not configured.");
  }

  const basic = btoa(PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET);
  const response = await fetch(PAYPAL_BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error("PayPal authentication failed.");
  }

  const payload = await response.json();
  return payload.access_token as string;
}

async function paypal(path: string, init: RequestInit = {}) {
  const token = await paypalAccessToken();
  const response = await fetch(PAYPAL_BASE + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.details?.[0]?.description || "PayPal request failed.");
  }
  return payload;
}

function premiumForStatus(status: string) {
  return status.toUpperCase() === "ACTIVE";
}

async function saveSubscription(userId: string, subscriptionId: string, status: string, nextBilling?: string | null) {
  const normalized = status.toUpperCase();
  const currentPeriodEnd = nextBilling ? new Date(nextBilling).toISOString() : null;

  const { error: subscriptionError } = await service
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paypal_subscription_id: subscriptionId,
        status: normalized,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (subscriptionError) throw subscriptionError;

  const { error: profileError } = await service
    .from("profiles")
    .update({ is_premium: premiumForStatus(normalized) })
    .eq("id", userId);

  if (profileError) throw profileError;
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

async function verifyApprovedSubscription(request: Request, subscriptionId: string) {
  const user = await authenticatedUser(request);
  if (!user) return json(request, { error: "Authentication required." }, 401);
  if (!PAYPAL_PLAN_ID) return json(request, { error: "PAYPAL_PLAN_ID is not configured." }, 503);

  const subscription = await paypal(
    "/v1/billing/subscriptions/" + encodeURIComponent(subscriptionId)
  );

  if (subscription.plan_id !== PAYPAL_PLAN_ID) {
    return json(request, { error: "Subscription uses the wrong PayPal plan." }, 400);
  }

  if (subscription.custom_id && subscription.custom_id !== user.id) {
    return json(request, { error: "Subscription does not belong to this AniWatch account." }, 403);
  }

  const paypalEmail = String(subscription.subscriber?.email_address || "").toLowerCase();
  const userEmail = String(user.email || "").toLowerCase();
  if (paypalEmail && userEmail && paypalEmail !== userEmail) {
    return json(request, { error: "PayPal subscriber email does not match the AniWatch account." }, 403);
  }

  const status = String(subscription.status || "APPROVAL_PENDING").toUpperCase();
  await saveSubscription(
    user.id,
    subscription.id,
    status,
    subscription.billing_info?.next_billing_time || null
  );

  return json(request, {
    ok: true,
    status,
    premium: premiumForStatus(status)
  });
}

async function verifyWebhook(request: Request, event: unknown) {
  if (!PAYPAL_WEBHOOK_ID) throw new Error("PAYPAL_WEBHOOK_ID is not configured.");

  const verification = await paypal("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: request.headers.get("paypal-auth-algo"),
      cert_url: request.headers.get("paypal-cert-url"),
      transmission_id: request.headers.get("paypal-transmission-id"),
      transmission_sig: request.headers.get("paypal-transmission-sig"),
      transmission_time: request.headers.get("paypal-transmission-time"),
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event
    })
  });

  return verification.verification_status === "SUCCESS";
}

function statusFromEvent(eventType: string, resource: any) {
  const direct: Record<string, string> = {
    "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
    "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
    "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
    "BILLING.SUBSCRIPTION.EXPIRED": "EXPIRED"
  };
  return direct[eventType] || String(resource?.status || "").toUpperCase() || null;
}

async function applyWebhook(event: any) {
  const resource = event?.resource || {};
  const subscriptionId =
    resource.id ||
    resource.billing_agreement_id ||
    resource.supplementary_data?.related_ids?.subscription_id;

  if (!subscriptionId) return;

  const { data: existing, error } = await service
    .from("subscriptions")
    .select("user_id")
    .eq("paypal_subscription_id", subscriptionId)
    .maybeSingle();

  if (error) throw error;
  if (!existing?.user_id) return;

  const status = statusFromEvent(String(event.event_type || ""), resource);
  if (!status) return;

  await saveSubscription(
    existing.user_id,
    subscriptionId,
    status,
    resource.billing_info?.next_billing_time || null
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json();

    if (body?.action === "verify") {
      const subscriptionId = String(body.subscriptionId || "");
      if (!subscriptionId) {
        return json(request, { error: "subscriptionId is required." }, 400);
      }
      return await verifyApprovedSubscription(request, subscriptionId);
    }

    const verified = await verifyWebhook(request, body);
    if (!verified) return json(request, { error: "Invalid PayPal webhook." }, 400);

    await applyWebhook(body);
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  } catch (error) {
    console.error(error);
    return json(
      request,
      { error: error instanceof Error ? error.message : "Unexpected error." },
      500
    );
  }
});
