/* ══ Filmová Databáza — sw.js  ══
   Strategy:
   - Shell (index.html, app.js, style.css, data.js, manifest, icon) → Cache-First
   - data.json  → Network-First (always try fresh, fallback to cache)
   - CDN libs   → Cache-First (immutable versioned URLs)
   ══════════════════════════════════════════════════════════════════ */

const CACHE = "filmy-20260530-1100";

const SHELL  = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"
];

/* ── Install: pre-cache shell ── */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

/* ── Fetch ── */
self.addEventListener("fetch", function(e){
  var url = e.request.url;

  /* data.json — Network-First */
  if(url.includes("data.json")){
    e.respondWith(
      fetch(e.request)
        .then(function(res){
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          return res;
        })
        .catch(function(){
          return caches.match(e.request);
        })
    );
    return;
  }

  /* Everything else — Cache-First */
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(res){
        if(!res || res.status !== 200 || res.type === "opaque") return res;
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return res;
      });
    })
  );
});
