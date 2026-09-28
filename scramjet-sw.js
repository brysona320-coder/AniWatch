importScripts("https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet-controller@0.0.14/dist/controller.sw.js");

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (self.$scramjetController?.shouldRoute(event)) {
    event.respondWith(self.$scramjetController.route(event));
  }
});
