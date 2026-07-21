/* ══ Filmová Databáza — sw.js  ══
   Strategy:
   - Shell (same-origin)  → Network-First (always fresh, fallback to cache)
   - data.json            → Network-First
   - CDN libs (versioned) → Cache-First (immutable)
   ══════════════════════════════════════════════════════════════════ */

const CACHE = "filmy-20260721-2303";

/* Runtime cache for TMDB posters/backdrops — separate from CACHE so it
   survives shell version bumps (posters rarely change; losing them on every
   deploy would defeat offline viewing). Capped so it can't grow unbounded
   across a 1700+ movie library. */
const POSTER_CACHE = "filmy-posters-v1";
const POSTER_CACHE_MAX = 300;

/* Cache API keys() returns entries in insertion order, so trimming from the
   front gives simple LRU-ish eviction without extra bookkeeping. */
function trimPosterCache(){
  caches.open(POSTER_CACHE).then(function(cache){
    cache.keys().then(function(keys){
      if(keys.length > POSTER_CACHE_MAX){
        cache.delete(keys[0]).then(trimPosterCache);
      }
    });
  });
}

const SHELL  = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./src/main.js",
  "./src/state.js",
  "./src/ui.js",
  "./src/storage.js",
  "./src/render.js",
  "./src/players.js",
  "./src/sync.js",
  "./src/settings.js",
  "./src/tv.js",
  "./src/lib/text.js",
  "./src/lib/parse.js",
  "./src/lib/sync-helpers.js",
  "./portable-handler.js",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
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

/* ── Activate: delete old caches, but keep the poster runtime cache ── */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE && k !== POSTER_CACHE; })
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

  /* TMDB images — Cache-First against the capped runtime cache, so posters
     and backdrops keep showing offline instead of breaking. Opaque no-cors
     responses (status 0) are cacheable and playable back as <img src>. */
  if(url.includes("image.tmdb.org")){
    e.respondWith(
      caches.open(POSTER_CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          if(cached){
            /* Serve the cached copy instantly, refresh it in the background. */
            fetch(e.request).then(function(res){ return cache.put(e.request, res); }).catch(function(){});
            return cached;
          }
          return fetch(e.request).then(function(res){
            cache.put(e.request, res.clone());
            trimPosterCache();
            return res;
          });
        });
      })
    );
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
      return caches.match(e.request).then(function(cached){
        if(cached) return cached;
        if(e.request.mode === "navigate"){
          return caches.match("./index.html");
        }
      });
    })
  );
});
