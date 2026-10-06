/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { buildCorePayload, buildLivePayload, mergeSyncPayloads } from './lib/sync-helpers.js';

S.ghSetStatus = function ghSetStatus(msg, type) {
  var el = document.getElementById('ghSyncStatus');
  if (el) { el.textContent = msg; el.className = 'sync-status ' + (type || 'info'); }
  var mb = document.getElementById('mainPullStatus');
  var mt = document.getElementById('mainPullStatusText');
  var ep = document.getElementById('emptyPullStatus');
  if (mt) mt.textContent = msg;
  if (ep) ep.textContent = msg;
  if (mb) {
    if (type === 'ok') {
      var bar = document.getElementById('mainPullBar');
      if (bar) bar.style.width = '100%';
      setTimeout(function(){
        mb.classList.add('hidden');
        if (bar) bar.style.width = '0%';
        /* bar is in flow now */
      }, 1400);
    } else if (type === 'err') {
      mb.classList.remove('hidden');
      mb.style.borderBottomColor = '#e05555';
      /* bar is in flow now */
      setTimeout(function(){
        mb.classList.add('hidden');
        mb.style.borderBottomColor = '';
        /* bar is in flow now */
      }, 3500);
    } else {
      mb.classList.remove('hidden');
      mb.style.borderBottomColor = '';
      /* bar is in flow now */
    }
  }
};

S.ghPullProgress = function ghPullProgress(pct) {
  var bar = document.getElementById('mainPullBar');
  if (bar) bar.style.width = pct + '%';
};

S.ghHeaders = function ghHeaders() {
  return {
    'Authorization': 'token ' + S.ghToken,
    'Accept':        'application/vnd.github.v3+json',
    'Content-Type':  'application/json'
  };
};

S.ghApiFileUrl = function ghApiFileUrl() {
  return 'https://api.github.com/repos/' + S.GH_REPO + '/contents/' + S.GH_FILE + '?ref=' + S.GH_BRANCH;
};

S.ghContentsUrl = function ghContentsUrl(path) {
  return 'https://api.github.com/repos/' + S.GH_REPO + '/contents/' + path;
};

S.ghEncodeB64 = function ghEncodeB64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
    return String.fromCharCode(parseInt(p1, 16));
  }));
};

S.ghLoadEtags = function ghLoadEtags() {
  try { return JSON.parse(localStorage.getItem(S.GH_ETAG_KEY) || '{}') || {}; } catch (e) { return {}; }
};

S.ghGetEtag = function ghGetEtag(path) { return S.ghLoadEtags()[path] || null; };

S.ghSetEtag = function ghSetEtag(path, etag) {
  if (!etag) return;
  var m = S.ghLoadEtags(); m[path] = etag;
  try { localStorage.setItem(S.GH_ETAG_KEY, JSON.stringify(m)); } catch (e) {}
};

S.ghGetSha = function ghGetSha(path) {
  var hdrs = S.ghHeaders();
  return fetch(S.ghContentsUrl(path) + '?ref=' + S.GH_BRANCH + '&t=' + Date.now(), { headers: hdrs, cache: 'no-store' })
    .then(function (r) {
      if (r.status === 401) throw new Error('401');
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('GET failed: ' + r.status);
      return r.json().then(function (d) {
        if (d.sha) return d.sha;
        return fetch('https://api.github.com/repos/' + S.GH_REPO + '/git/trees/' + S.GH_BRANCH, { headers: hdrs, cache: 'no-store' })
          .then(function (tr) { return tr.json(); })
          .then(function (tree) {
            var f = (tree.tree || []).find(function (x) { return x.path === path; });
            return f ? f.sha : null;
          });
      });
    });
};

S.ghPutFile = function ghPutFile(path, jsonStr, _retried) {
  var hdrs = S.ghHeaders();
  var encoded = S.ghEncodeB64(jsonStr);
  return S.ghGetSha(path).then(function (sha) {
    var body = {
      message: 'FilmDB sync ' + new Date().toISOString().slice(0, 10) + ' (' + path + ')',
      content: encoded,
      branch: S.GH_BRANCH
    };
    if (sha) body.sha = sha;
    return fetch(S.ghContentsUrl(path), { method: 'PUT', headers: hdrs, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().then(function (d) { return { status: r.status, ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (res.ok) return res;
        if ((res.status === 409 || res.status === 422) && !_retried) {
          return new Promise(function (resolve, reject) {
            setTimeout(function () { S.ghPutFile(path, jsonStr, true).then(resolve, reject); }, 1200);
          });
        }
        throw new Error((res.d && res.d.message) || ('HTTP ' + res.status));
      });
  });
};

S.ghPush = function ghPush() {
  if (!S.ghToken) { S.ghSetStatus('Nastav GitHub token.', 'err'); return Promise.resolve(false); }
  if (S.ghPushInProgress) { S.scheduleAutoPush('busy'); return S._ghPushPromise || Promise.resolve(false); }
  if (!S.all || !S.all.length) {
    S.ghSetStatus('Žiadne dáta na uloženie. Najprv importuj alebo načítaj.', 'err');
    S.toast('Databáza je prázdna');
    return Promise.resolve(false);
  }

  var revision = S.getSyncRevision();
  var movieCount = S.all.length;
  // Split model: data.json = core (movies + collections),
  //              data-live.json = liveCache (ratings/posters/trailers).
  var coreJson = JSON.stringify(buildCorePayload({
    movies: S.all,
    favourites: Array.from(S.favs),
    watchlist: Array.from(S.wl),
    watched: Array.from(S.watched),
    watchedDates: S.watchedDates
  }), null, 2);
  var liveJson = JSON.stringify(buildLivePayload(S.liveCache), null, 2);
  S.ghPushInProgress = true;
  S._syncEpoch++; // Any pull started before this upload now has an older snapshot.
  S.ghSetStatus('Pripravujem ' + movieCount + ' filmov na upload...', 'info');

  // Core first (small, critical). If the live write fails afterwards, the
  // movie list + collections are already safely saved and liveCache is
  // re-derivable from TMDB — so a partial failure never loses user data.
  S.ghSetStatus('Nahrávam dáta (1/2)…', 'info');
  S._ghPushPromise = S.ghPutFile(S.GH_FILE, coreJson)
    .then(function () {
      // A completed core write confirms this exact library, not edits made
      // while the request was running. Even a later media failure is safe.
      S.acknowledgeSync(revision);
      try { localStorage.removeItem(S.GH_ETAG_KEY); } catch (e) {}
      S.ghSetStatus('Nahrávam hodnotenia (2/2)…', 'info');
      return S.ghPutFile(S.GH_LIVE_FILE, liveJson);
    })
    .then(function () {
      var ts = new Date().toLocaleTimeString('sk');
      var pending = S.getSyncRevision();
      S.ghSetStatus('✓ Uložené ' + ts + ' · ' + movieCount + ' filmov' +
        (pending ? ' · Novšie lokálne zmeny ešte čakajú na uloženie.' : ''), 'ok');
      S.toast(pending ? 'Snapshot uložený na GitHub. Novšie zmeny ešte čakajú.' : 'Databáza uložená na GitHub!');
      if (pending) S.scheduleAutoPush('newer-changes');
      return true;
    })
    .catch(function (e) {
      if (e.message === '401') {
        S.ghSetStatus('❌ Token odmietnutý (401). Skontroluj: oprávnenie, expiráciu, SSO.', 'err');
        S.toast('GitHub 401: Token neplatný. Vygeneruj nový fine-grained PAT.');
      } else {
        S.ghSetStatus('Chyba: ' + e.message, 'err');
      }
      return false;
    })
    .finally(function () {
      S.ghPushInProgress = false;
      S._ghPushPromise = null;
    });
  return S._ghPushPromise;
};

S.ghFetchFile = function ghFetchFile(path, useEtag) {
  var headers = Object.assign({}, S.ghToken ? S.ghHeaders() : { 'Accept': 'application/vnd.github.v3+json' });
  // ghHeaders() sets Content-Type for writes — irrelevant for GET, harmless.
  var etag = useEtag ? S.ghGetEtag(path) : null;
  if (etag) headers['If-None-Match'] = etag;
  var url = S.ghContentsUrl(path) + '?ref=' + S.GH_BRANCH;
  if (!etag) url += '&t=' + Date.now();
  return fetch(url, { headers: headers, cache: 'no-store' }).then(function (r) {
    if (r.status === 304) return { status: 304 };
    if (r.status === 401) throw new Error('401_UNAUTH');
    if (r.status === 403) {
      var reset = r.headers.get('X-RateLimit-Reset');
      var wait = reset ? Math.ceil((reset * 1000 - Date.now()) / 60000) : '?';
      throw new Error('403_RATELIMIT:' + wait);
    }
    if (r.status === 429) throw new Error('429_RATELIMIT');
    if (r.status === 404) return { status: 404 };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var newEtag = r.headers.get('ETag');
    return r.json().then(function (file) {
      if (!file.content && file.download_url) {
        return fetch(file.download_url + '?t=' + Date.now())
          .then(function (r2) { if (!r2.ok) throw new Error('download_url failed: ' + r2.status); return r2.text(); })
          .then(function (txt) { return { status: 200, payload: JSON.parse(txt), etag: newEtag }; });
      }
      if (!file.content) return { status: 404 };
      var b64 = file.content.replace(/\s/g, '');
      var binary = atob(b64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var raw = new TextDecoder('utf-8').decode(bytes);
      return { status: 200, payload: JSON.parse(raw), etag: newEtag };
    });
  });
};

S.ghPull = function ghPull(options) {
  if (S._ghPullRunning) return S._ghPullPromise || Promise.resolve(false);
  if (S.ghPushInProgress) {
    S.ghSetStatus('Prebieha ukladanie na GitHub. Načítanie skús po dokončení.', 'info');
    return Promise.resolve(false);
  }
  var pullRevision = S.getSyncRevision();
  if (pullRevision && !(options && options.manual === true && confirm(
    'Lokálne zmeny ešte nie sú uložené na GitHub.\n\nNačítanie ich nahradí verziou z GitHubu. ' +
    'Ak ich chceš zachovať, zruš načítanie a použi Uložiť na GitHub alebo Export JSON.\n\nNaozaj nahradiť lokálne dáta?'
  ))) {
    S.ghSetStatus('Lokálne zmeny čakajú na uloženie. Najprv ich ulož na GitHub; načítanie ich neprepíše.', 'err');
    return Promise.resolve(false);
  }
  S._ghPullRunning = true;
  var pullEpoch = S._syncEpoch;
  S.ghPullProgress(10);
  S.ghSetStatus('Načítavam z GitHubu…', 'info');

  var hasNewerLocalState = function () {
    return S.ghPushInProgress || S.getSyncRevision() !== pullRevision || S._syncEpoch !== pullEpoch;
  };
  var keepLocalState = function () {
    S.ghSetStatus('Lokálne dáta sa počas načítania zmenili. Staršia odpoveď z GitHubu ich neprepíše.', 'err');
    return false;
  };

  var ghPullAttempt = function (attempt) {
    // Conditional GET both files; If-None-Match lets GitHub answer 304 (no body)
    // when nothing changed → skips re-downloading the large data-live.json.
    var hasLocalMovies = !!(S.all && S.all.length && !pullRevision);
    return Promise.all([S.ghFetchFile(S.GH_FILE, hasLocalMovies), S.ghFetchFile(S.GH_LIVE_FILE, hasLocalMovies)])
      .then(function (res) {
        if (hasNewerLocalState()) return keepLocalState();
        var coreRes = res[0], liveRes = res[1];

        if (coreRes.status === 404) {
          S.ghSetStatus('data.json ešte neexistuje — najprv ulož (Push).', 'err');
          return false;
        }

        var coreUnchanged = coreRes.status === 304;
        var liveUnchanged = liveRes.status === 304 || liveRes.status === 404;
        if (coreUnchanged && liveUnchanged) {
          S.ghPullProgress(100);
          S.ghSetStatus('✓ Už aktuálne — nič sa nezmenilo', 'ok');
          return true;
        }

        S.ghPullProgress(40);
        // At least one file changed → ensure full content for any that answered 304.
        var needCore = coreRes.status === 200 ? Promise.resolve(coreRes) : S.ghFetchFile(S.GH_FILE, false);
        var needLive = liveRes.status === 200 ? Promise.resolve(liveRes)
          : (liveRes.status === 404 ? Promise.resolve({ status: 404 }) : S.ghFetchFile(S.GH_LIVE_FILE, false));

        return Promise.all([needCore, needLive]).then(function (full) {
          if (hasNewerLocalState()) return keepLocalState();
          var core = full[0].payload || {};
          var live = (full[1] && full[1].payload) ? full[1].payload : null;
          var merged = mergeSyncPayloads(core, live);

          if (!merged.movies || !merged.movies.length) {
            S.ghSetStatus('Súbor data.json je prázdny — najprv ulož (Push).', 'err');
            return false;
          }

          // Rescue posters from baked-in / current data
          var bakedMap = {};
          try {
            buildMovies().forEach(function (m) { if (m.poster_thumb && m.poster_thumb.length > 10) bakedMap[m.num] = m.poster_thumb; });
          } catch (e) {}
          S.all.forEach(function (m) { if (m.poster_thumb && m.poster_thumb.length > 10) bakedMap[m.num] = m.poster_thumb; });
          merged.movies.forEach(function (m) { if ((!m.poster_thumb || m.poster_thumb.length < 10) && bakedMap[m.num]) m.poster_thumb = bakedMap[m.num]; });

          S.ghPullProgress(60);
          // Persist the critical movie list before applying or caching the
          // response. A failed save must not look like a durable successful pull.
          var previousMovies = S.all;
          S.all = merged.movies;
          var moviesSaved = S.saveMovies({ synced: true });
          if (!moviesSaved) {
            S.all = previousMovies;
            S.ghSetStatus('Načítané filmy sa nepodarilo uložiť do prehliadača. Uvoľni lokálne úložisko.', 'err');
            return false;
          }
          Object.assign(S.liveCache, merged.liveCache || {});
          var liveSaved = S.saveLiveCache();
          var synced = { synced: true };
          S.favs = new Set(merged.favourites); var favsSaved = S.safeSave(S.FK, JSON.stringify(merged.favourites), synced);
          S.wl = new Set(merged.watchlist); var wlSaved = S.safeSave(S.WK, JSON.stringify(merged.watchlist), synced);
          S.watched = new Set(merged.watched); var watchedSaved = S.safeSave(S.VK, JSON.stringify(merged.watched), synced);
          S.watchedDates = merged.watchedDates || {}; var datesSaved = S.safeSave(S.VDK, JSON.stringify(S.watchedDates), synced);

          S.all.forEach(function (m) {
            if ((!m.poster_thumb || m.poster_thumb.length < 10) && S.liveCache[m.id] && S.liveCache[m.id].posterUrl) {
              m.poster_thumb = S.liveCache[m.id].posterUrl;
            }
          });

          // Persist ETags only after a fully successful apply.
          var fullySaved = liveSaved && favsSaved && wlSaved && watchedSaved && datesSaved;
          if (fullySaved) {
            S.acknowledgeSync(pullRevision);
            if (full[0].etag) S.ghSetEtag(S.GH_FILE, full[0].etag);
            if (full[1] && full[1].etag) S.ghSetEtag(S.GH_LIVE_FILE, full[1].etag);
          }

          S.ghPullProgress(80);
          var ts2 = new Date().toLocaleTimeString('sk');
          S.buildFuse();
          S.renderAll();
          S.ghPullProgress(100);
          S.ghSetStatus(fullySaved ? '✓ Načítané ' + ts2 + ' · ' + S.all.length + ' filmov' :
            'Filmy načítané, ale časť kolekcií alebo hodnotení sa neuložila. Uvoľni lokálne úložisko.', fullySaved ? 'ok' : 'err');
          if (fullySaved) S.toast('Databáza načítaná z GitHubu!');
          return fullySaved;
        });
      })
      .catch(function (e) {
        if (hasNewerLocalState()) return keepLocalState();
        var msg = (e && e.message) ? e.message : String(e);
        if (msg.indexOf('401_UNAUTH') >= 0) {
          S.ghSetStatus('⚠ Neplatný GitHub token — skontroluj nastavenia.', 'err');
        } else if (msg.indexOf('403_RATELIMIT') >= 0) {
          var wait = msg.split(':')[1] || '?';
          S.ghSetStatus('⏳ GitHub rate limit — skús znova o ' + wait + ' min.', 'err');
        } else if (msg.indexOf('429_RATELIMIT') >= 0) {
          S.ghSetStatus('⏳ GitHub rate limit — skús znova o chvíľu.', 'err');
        } else if (attempt < 2) {
          S.ghSetStatus('Opakujem pokus ' + (attempt + 1) + '/2…', 'info');
          return new Promise(function (resolve) { setTimeout(resolve, 3000); })
            .then(function () {
              return hasNewerLocalState() ? keepLocalState() : ghPullAttempt(attempt + 1);
            });
        } else {
          S.ghSetStatus('Chyba: ' + msg, 'err');
        }
        return false;
      });
  };
  S._ghPullPromise = ghPullAttempt(0).finally(function () {
    S._ghPullRunning = false;
    S._ghPullPromise = null;
  });
  return S._ghPullPromise;
};

S.initGhSync = function initGhSync() {
  S.ghToken = localStorage.getItem('mdb_gh_token') || '';
  // Never pre-fill token — show placeholder dots if token exists
  var inp = document.getElementById('ghTokenInp');
  var st  = document.getElementById('ghTokenSt');
  if (inp) inp.value = '';
  if (inp && S.ghToken) inp.placeholder = '••••••••••••••••••••••••••••••••••••••••';
  if (st && S.ghToken)  { st.textContent = '✓ Token je uložený'; st.className = 'sett-key-st ok'; }
  if (S.getSyncRevision()) S.scheduleAutoPush('pending-after-reload');
};

S.validateGhToken = function validateGhToken(token, cb) {
  fetch('https://api.github.com/user', {
    headers: {'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json'}
  }).then(function(r) {
    if (r.status === 200) return r.json().then(function(u) { cb(true, u.login); });
    if (r.status === 401) cb(false, 'Token neplatný alebo expiroval');
    else cb(false, 'HTTP ' + r.status);
  }).catch(function(e) { cb(false, e.message); });
};

S.autoCheckGitHub = function autoCheckGitHub() {
  if (S.all.length > 0) return;
  var es = document.getElementById('emptySt');
  if (!S.ghToken) {
    if (es) es.style.display = 'flex';
    return;
  }
  // If autoPull is enabled, init() already scheduled a ghPull — don't double-fetch.
  if (S.autoPull) return;
  S.toast('Žiadne lokálne dáta. Načítavam z GitHubu...');
  setTimeout(function() { S.ghPull(); }, 600);
};

S.scheduleAutoPush = function scheduleAutoPush(reason) {
  if (!S.ghToken || S.prefs.autoPush === false) return;
  if (S.autoPushTimer) clearTimeout(S.autoPushTimer);
  S.autoPushTimer = setTimeout(function() {
    S.autoPushTimer = null;
    if (S.ghPushInProgress) { S.scheduleAutoPush('deferred'); return; }
    if (S.all && S.all.length) S.ghPush();
  }, 5000);
};
