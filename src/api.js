export function validBaseUrl(value) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash) return "";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
      return "";
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export async function fetchJson(baseUrl, path, signal, requestOptions = {}) {
  const base = validBaseUrl(baseUrl);
  if (!base) throw new Error("Enter a valid HTTPS API URL in API settings.");
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...requestOptions,
      signal,
      headers: { Accept: "application/json", ...requestOptions.headers },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Could not reach the API. Check its URL, availability, and CORS settings.",
    );
  }
  if (!response.ok) {
    if (response.status === 429)
      throw new Error("The API is rate limited. Try again shortly.");
    throw new Error(`The API returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(
      "The API did not return JSON. Check its URL in API settings.",
    );
  }
}
