const CACHE = "imagetools-v4";
const ASSETS = [
  "./",
  "index.html",
  "manifest.json",
  "tools/shared.css",
  "tools/shared.js",
  "tools/resize.html",
  "tools/crop.html",
  "tools/rotate.html",
  "tools/convert.html",
  "tools/watermark.html",
  "tools/meme.html",
  "tools/photo-editor.html",
  "tools/batch.html"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (res.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});