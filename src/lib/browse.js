/* Search and scheduling helpers shared by the library UI and unit tests. */
export function createLibrarySearch(createIndex, cacheLimit = 8) {
  let library = null, libraryLength = 0, index = null;
  let exactFields = new WeakMap();
  const fuzzyCache = new Map();

  function reset() {
    library = null;
    index = null;
    exactFields = new WeakMap();
    fuzzyCache.clear();
  }

  function fields(movie) {
    if (!exactFields.has(movie)) {
      exactFields.set(movie, [
        movie.title || '', movie.director || '', String(movie.year || ''),
        (movie.genres || []).join(' '), (movie._tags || []).join(' ')
      ].map(value => value.toLowerCase()));
    }
    return exactFields.get(movie);
  }

  function search(movies, pool, rawQuery) {
    if (movies !== library || movies.length !== libraryLength) {
      reset();
      library = movies;
      libraryLength = movies.length;
    }
    const query = rawQuery.trim().toLowerCase();
    if (!query) return { items: pool.slice(), mode: '', query, matches: new Map() };
    const exact = pool.filter(movie => fields(movie).some(value => value.includes(query)));
    if (exact.length) return { items: exact, mode: 'exact', query, matches: new Map() };
    if (!pool.length) return { items: [], mode: 'fuzzy', query, matches: new Map() };

    let results = fuzzyCache.get(query);
    if (results === undefined) {
      if (!index) index = createIndex(movies);
      results = index.search(query);
    }
    // One full-library index: filtering its results preserves Fuse scores and
    // match ranges without rebuilding an index every time a filter changes.
    fuzzyCache.delete(query);
    fuzzyCache.set(query, results);
    if (fuzzyCache.size > cacheLimit) fuzzyCache.delete(fuzzyCache.keys().next().value);
    const allowed = new Set(pool);
    const items = [], matches = new Map();
    for (const result of results) {
      if (!allowed.has(result.item)) continue;
      items.push(result.item);
      matches.set(result.item.id, result.matches);
    }
    return { items, mode: 'fuzzy', query, matches };
  }

  return { search, reset };
}

export function createDebouncedTask(callback, delay, onPending = () => {}) {
  let timer = null;
  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    onPending(false);
  }
  function schedule() {
    if (timer !== null) clearTimeout(timer);
    onPending(true);
    timer = setTimeout(() => {
      timer = null;
      onPending(false);
      callback();
    }, delay);
  }
  function flush() {
    if (timer === null) return false;
    cancel();
    callback();
    return true;
  }
  return { schedule, cancel, flush };
}

export function pageRange(page, pageSize, total) {
  const start = page * pageSize;
  return { start, end: Math.min(start + pageSize, total) };
}

export function needsMoreCards(scrollTop, viewportHeight, contentHeight, remaining, margin = 300) {
  return remaining > 0 && viewportHeight > 0 &&
    scrollTop + viewportHeight >= contentHeight - margin;
}
