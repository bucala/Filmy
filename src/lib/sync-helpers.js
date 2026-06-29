/* Pure helpers for the split GitHub sync model — no DOM, no network.
   data.json      → core: movies + collections (small, changes often)
   data-live.json → liveCache: TMDB ratings/posters/trailers (large, changes rarely)
   Unit-tested in test/. */

export const SYNC_VERSION = 2;

/** Strip base64 posters from a movie (kept out of the synced core). */
function stripBase64Poster(m) {
  var c = Object.assign({}, m);
  if (c.poster_thumb && c.poster_thumb.indexOf('data:') === 0) c.poster_thumb = '';
  return c;
}

/** Build the small core payload written to data.json. */
export function buildCorePayload(state) {
  return {
    version: SYNC_VERSION,
    updated: new Date().toISOString(),
    movies: (state.movies || []).map(stripBase64Poster),
    favourites: state.favourites || [],
    watchlist: state.watchlist || [],
    watched: state.watched || [],
    watchedDates: state.watchedDates || {}
  };
}

/** Build the large media payload written to data-live.json. */
export function buildLivePayload(liveCache) {
  return {
    version: SYNC_VERSION,
    updated: new Date().toISOString(),
    liveCache: liveCache || {}
  };
}

/** Merge a core payload and an (optional) live payload back into runtime shape.
    Backward compatible: a v1 core payload that still embeds `liveCache`
    is used as the fallback when no separate live payload exists. */
export function mergeSyncPayloads(core, live) {
  core = core || {};
  var liveCache = {};
  if (live && live.liveCache && Object.keys(live.liveCache).length) {
    liveCache = live.liveCache;
  } else if (core.liveCache && Object.keys(core.liveCache).length) {
    liveCache = core.liveCache;
  }
  return {
    movies: core.movies || [],
    favourites: core.favourites || [],
    watchlist: core.watchlist || [],
    watched: core.watched || [],
    watchedDates: core.watchedDates || {},
    liveCache: liveCache
  };
}
