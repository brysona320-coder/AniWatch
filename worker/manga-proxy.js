// Deploy separately as a Cloudflare Worker, then enter its URL under Manga API settings.
const MANGADEX = "https://api.mangadex.org";
const ALLOWED_ORIGINS = new Set([
  "https://brysona320-coder.github.io",
  "http://localhost:8000",
]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ROUTES = [
  new RegExp(`^/manga$`),
  new RegExp(`^/manga/${UUID}/feed$`, "i"),
  new RegExp(`^/at-home/server/${UUID}$`, "i"),
];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    if (!ALLOWED_ORIGINS.has(origin))
      return new Response("Origin not allowed", { status: 403 });
    const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
    if (request.method === "OPTIONS")
      return new Response(null, {
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Accept",
        },
      });
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405, headers: cors });
    const url = new URL(request.url);
    if (!ROUTES.some((route) => route.test(url.pathname)))
      return new Response("Route not allowed", { status: 404, headers: cors });
    const upstream = await fetch(`${MANGADEX}${url.pathname}${url.search}`, {
      headers: { Accept: "application/json" },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  },
};
