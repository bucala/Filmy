export const DEFAULT_PREFS = Object.freeze({
  view: 'grid', sort: 'num', sortDir: 'desc', showRecent: false, autoPush: true
});
export const RATING_SOURCES = Object.freeze(['csfd', 'tmdb', 'imdb']);

export function normalizeRatingSource(value) {
  return RATING_SOURCES.includes(value) ? value : 'csfd';
}
