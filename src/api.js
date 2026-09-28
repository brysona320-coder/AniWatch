import { fetchViaScramjet, setScramjetProxyConfig } from "./scramjet-proxy.js";

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

let apiProxyTemplate = "";

export function setApiProxyTemplate(value) {
  apiProxyTemplate = validProxyTemplate(value);
}

export function setScramjetProxy(enabled, wispUrl) {
  setScramjetProxyConfig({ enabled, wispUrl });
}

export function validProxyTemplate(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || url.hash) return "";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return "";
    if (!url.href.includes("{url}")) return "";
    return url.href;
  } catch {
    return "";
  }
}

function proxyTargetUrl(targetUrl) {
  return apiProxyTemplate
    ? apiProxyTemplate.replaceAll("{url}", encodeURIComponent(targetUrl))
    : targetUrl;
}

export async function fetchJson(baseUrl, path, signal, requestOptions = {}) {
  const base = validBaseUrl(baseUrl);
  if (!base) throw new Error("Enter a valid HTTPS API URL in API settings.");
  let response;
  try {
    const targetUrl = `${base}${path}`;
    if (apiProxyTemplate) {
      response = await fetch(proxyTargetUrl(targetUrl), {
        ...requestOptions,
        signal,
        headers: { Accept: "application/json", ...requestOptions.headers },
      });
    } else {
      response = await fetchViaScramjet(targetUrl, {
        ...requestOptions,
        signal,
        headers: { Accept: "application/json", ...requestOptions.headers },
      });
    }
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      apiProxyTemplate ? "Could not reach the configured HTTP proxy. Check its URL/template and availability." : "Could not reach the configured Scramjet/Wisp proxy. Check the Wisp endpoint and try again.",
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
