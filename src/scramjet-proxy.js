const SCRAMJET_VERSION = "2.0.67-alpha.2";
const CONTROLLER_VERSION = "0.0.14";
const LIBCURL_VERSION = "2.0.5";

let config = {
  enabled: false,
  wispUrl: "wss://anura.pro/",
};
let controllerPromise = null;
let frame = null;

const CDN = {
  scramjet: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@${SCRAMJET_VERSION}/dist/scramjet.js`,
  wasm: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@${SCRAMJET_VERSION}/dist/scramjet.wasm`,
  controllerApi: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet-controller@${CONTROLLER_VERSION}/dist/controller.api.js`,
  controllerInject: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet-controller@${CONTROLLER_VERSION}/dist/controller.inject.js`,
  controllerSw: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet-controller@${CONTROLLER_VERSION}/dist/controller.sw.js`,
  libcurl: `https://cdn.jsdelivr.net/npm/@mercuryworkshop/libcurl-transport@${LIBCURL_VERSION}/dist/index.mjs`,
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-scramjet-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load Scramjet runtime: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.scramjetSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load Scramjet runtime: ${src}`)), { once: true });
    document.head.append(script);
  });
}

function waitForServiceWorker(timeoutMs = 12000) {
  if (navigator.serviceWorker.controller) return Promise.resolve(navigator.serviceWorker.controller);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Scramjet service worker did not take control.")), timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      clearTimeout(timer);
      if (navigator.serviceWorker.controller) resolve(navigator.serviceWorker.controller);
      else reject(new Error("Scramjet service worker is unavailable."));
    }, { once: true });
  });
}

export function setScramjetProxyConfig(next = {}) {
  config = {
    enabled: Boolean(next.enabled),
    wispUrl: String(next.wispUrl || "").trim(),
  };
  if (!config.enabled) {
    controllerPromise = null;
    frame = null;
  }
}

async function init() {
  if (!config.enabled) throw new Error("Scramjet proxy is disabled.");
  if (!/^wss?:\\/\\//.test(config.wispUrl) || !config.wispUrl.endsWith("/")) {
    throw new Error("Enter a valid Wisp WebSocket URL ending in /.");
  }

  await loadScript(CDN.scramjet);
  await loadScript(CDN.controllerApi);

  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register("./scramjet-sw.js", { scope: "./" });
    await waitForServiceWorker();
  }

  const { default: LibcurlClient } = await import(CDN.libcurl);
  const transport = new LibcurlClient({ wisp: config.wispUrl });

  const Controller = globalThis.$scramjetController?.Controller;
  if (!Controller) throw new Error("Scramjet controller runtime did not load.");

  const controller = new Controller({
    serviceworker: navigator.serviceWorker.controller,
    transport,
    scramjetConfig: {
      prefix: "/~/sj/",
      scramjetPath: CDN.scramjet,
      injectPath: CDN.controllerInject,
      wasmPath: CDN.wasm,
    },
  });
  await controller.wait();

  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.display = "none";
  document.body.append(iframe);

  frame = controller.createFrame(iframe);
  return controller;
}

export async function getScramjetController() {
  if (!controllerPromise) {
    controllerPromise = init().catch((error) => {
      controllerPromise = null;
      frame = null;
      throw error;
    });
  }
  return controllerPromise;
}

export async function fetchViaScramjet(url, options = {}) {
  const controller = await getScramjetController();
  if (!frame) throw new Error("Scramjet frame is not initialized.");

  const response = await frame.fetchHandler.client.fetch(url, options);
  return response;
}

export function getScramjetState() {
  return {
    enabled: config.enabled,
    wispUrl: config.wispUrl,
    ready: Boolean(frame),
    controller: Boolean(controllerPromise),
  };
}
