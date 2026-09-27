export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  if (body != null && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch("/api" + path, {
    ...options,
    headers,
    credentials: "same-origin"
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}
