// Deploy as a Cloudflare Worker. Set UPSTREAM_ORIGIN to the API you operate or are authorized to proxy.
const ALLOWED_ORIGIN = "https://brysona320-coder.github.io";
const ALLOWED_PATHS = [
  /^\/search$/,
  /^\/anime\/[a-zA-Z0-9_-]+\/episode$/,
  /^\/ep\/[a-zA-Z0-9_-]+$/,
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept",
      Vary: "Origin",
    };
    if (origin && origin !== ALLOWED_ORIGIN)
      return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405, headers: cors });
    const incoming = new URL(request.url);
    if (!ALLOWED_PATHS.some((pattern) => pattern.test(incoming.pathname)))
      return new Response("Not found", { status: 404, headers: cors });
    let upstream;
    try {
      upstream = new URL(env.UPSTREAM_ORIGIN);
      if (upstream.protocol !== "https:" || upstream.username || upstream.password ||
          upstream.search || upstream.hash || upstream.pathname !== "/")
        throw new Error("Invalid upstream");
    } catch {
      return new Response("UPSTREAM_ORIGIN must be an HTTPS origin", { status: 500, headers: cors });
    }
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;
    try {
      const response = await fetch(upstream, {
        headers: { Accept: "application/json" },
        redirect: "error",
      });
      const type = response.headers.get("Content-Type") || "";
      if (!type.toLowerCase().includes("application/json"))
        return new Response("Upstream did not return JSON", { status: 502, headers: cors });
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...cors,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new Response("Upstream unavailable", { status: 502, headers: cors });
    }
  },
};
