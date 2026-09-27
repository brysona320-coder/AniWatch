const SHELL_CACHE = "aniwatch-shell-v2";
const MEDIA_CACHE = "aniwatch-media-v2";
const DB_NAME = "aniwatch-offline";
const DB_VERSION = 1;
const STORE = "downloads";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles-fullstack.css",
  "./src/api.js",
  "./src/providers.js",
  "./src/streaming.js",
  "./src/app.js",
  "./src/client-api.js",
  "./src/fullstack.js",
  "./vendor/hls.min.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => ![SHELL_CACHE, MEDIA_CACHE].includes(name))
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith((async () => {
    const media = await caches.open(MEDIA_CACHE);
    const mediaHit = await media.match(request, { ignoreVary: true });
    if (mediaHit) return mediaHit;

    if (url.origin === self.location.origin) {
      const shell = await caches.open(SHELL_CACHE);
      const cached = await shell.match(request);
      if (cached) {
        event.waitUntil(fetch(request).then((response) => {
          if (response.ok) return shell.put(request, response.clone());
        }).catch(() => {}));
        return cached;
      }
    }

    try {
      const response = await fetch(request);
      if (
        response.ok &&
        url.origin === self.location.origin &&
        !url.pathname.startsWith("/api/")
      ) {
        const shell = await caches.open(SHELL_CACHE);
        event.waitUntil(shell.put(request, response.clone()));
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        const shell = await caches.open(SHELL_CACHE);
        return (await shell.match("./index.html")) || Response.error();
      }
      throw error;
    }
  })());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(value) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function dbDelete(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function dbAll() {
  const db = await openDb();
  const values = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return values.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function manifestUrls(text, base) {
  const urls = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      urls.push(new URL(line, base).href);
    } catch {}
  }
  return urls;
}

async function cacheFetch(cache, url) {
  const existing = await cache.match(url, { ignoreVary: true });
  if (existing) return existing.clone();
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error("Media host returned HTTP " + response.status + ".");
  await cache.put(url, response.clone());
  return response;
}

async function cacheHls(cache, url, seen = new Set()) {
  if (seen.has(url)) return;
  seen.add(url);
  const response = await cacheFetch(cache, url);
  const type = response.headers.get("content-type") || "";
  const isManifest = /mpegurl/i.test(type) || /\.m3u8(?:\?|$)/i.test(url);
  if (!isManifest) return;
  const text = await response.clone().text();
  for (const child of manifestUrls(text, url)) {
    if (/\.m3u8(?:\?|$)/i.test(child)) {
      await cacheHls(cache, child, seen);
    } else {
      await cacheFetch(cache, child);
    }
  }
}

async function deleteDownload(id) {
  const items = await dbAll();
  const item = items.find((entry) => entry.id === id);
  if (item) {
    const cache = await caches.open(MEDIA_CACHE);
    if (item.cachedUrls?.length) {
      await Promise.all(item.cachedUrls.map((url) => cache.delete(url)));
    } else if (item.sourceUrl) {
      await cache.delete(item.sourceUrl);
    }
  }
  await dbDelete(id);
}

self.addEventListener("message", (event) => {
  const port = event.ports?.[0];
  const reply = (payload) => port?.postMessage(payload);
  const data = event.data || {};

  if (data.type === "LIST_DOWNLOADS") {
    event.waitUntil(dbAll().then((items) => reply({ items })).catch((error) => reply({ error: error.message })));
    return;
  }

  if (data.type === "DELETE_DOWNLOAD") {
    event.waitUntil(deleteDownload(data.id).then(() => reply({ ok: true })).catch((error) => reply({ error: error.message })));
    return;
  }

  if (data.type === "DOWNLOAD_MEDIA") {
    event.waitUntil((async () => {
      const meta = data.meta;
      if (!meta?.id || !meta.sourceUrl) throw new Error("No media source is selected.");
      const cache = await caches.open(MEDIA_CACHE);
      const before = new Set((await cache.keys()).map((request) => request.url));
      if (meta.hls || /\.m3u8(?:\?|$)/i.test(meta.sourceUrl)) {
        await cacheHls(cache, meta.sourceUrl);
      } else {
        await cacheFetch(cache, meta.sourceUrl);
      }
      const after = (await cache.keys()).map((request) => request.url);
      const cachedUrls = after.filter((url) => !before.has(url) || url === meta.sourceUrl);
      await dbPut({ ...meta, cachedUrls, status: "ready" });
      reply({ ok: true, message: "Download complete." });
    })().catch((error) => {
      reply({
        error: "Could not save this video offline. The media host may block downloads or the browser may not have enough storage. " + error.message
      });
    }));
  }
});
