/* ══ Filmová Databáza — sw.js  ══
   Strategy:
   - Shell (same-origin)  → Network-First (always fresh, fallback to cache)
   - data.json            → Network-First
   - CDN libs (versioned) → Cache-First (immutable)
   ══════════════════════════════════════════════════════════════════ */

const CACHE = "filmy-20260613-0842";

const SHELL  = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./favicon.svg",
  "https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"
];

/* ── Install: pre-cache shell (bypass HTTP cache) ── */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){
        return Promise.all(
          SHELL.map(function(url){
            return fetch(url, {cache:"no-store"}).then(function(res){
              if(!res.ok) throw new Error("Failed to fetch "+url);
              return c.put(url, res);
            });
          })
        );
      })
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

  /* API routes — Network-Only (never cache) */
  if(url.includes("/api/")){
    e.respondWith(fetch(e.request));
    return;
  }

  /* GitHub API / raw — Network-Only (never cache auth/sync traffic) */
  if(url.includes("api.github.com") || url.includes("raw.githubusercontent.com")){
    return;
  }

  /* TMDB images — passthrough (don't intercept cross-origin opaque responses) */
  if(url.includes("image.tmdb.org")){
    return;
  }

  /* CDN libs — Cache-First (versioned, immutable) */
  if(url.includes("cdn.jsdelivr.net") || url.includes("cdnjs.cloudflare.com") ||
     url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        if(cached) return cached;
        return fetch(e.request).then(function(res){
          if(!res || res.status !== 200) return res;
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
          return res;
        });
      })
    );
    return;
  }

  /* Same-origin (shell + data.json) — Network-First */
  e.respondWith(
    fetch(e.request).then(function(res){
      if(res.ok){
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});
