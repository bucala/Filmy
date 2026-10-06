/* Movie persistence and TMDB shaping shared by both add flows. */

export function parseStoredMovies(value) {
  try {
    var movies = JSON.parse(value);
    if (!Array.isArray(movies) || movies.some(function(m) {
      return !m || typeof m !== 'object' || Array.isArray(m);
    })) return [];
    return movies.map(function(m) {
      return Object.assign({}, m, { year: parseInt(m.year, 10) || 0 });
    });
  } catch (e) { return []; }
}

export function moviesForStorage(movies) {
  return movies.map(function(m) {
    var copy = Object.assign({}, m);
    if (copy.poster_thumb && copy.poster_thumb.indexOf('data:') === 0) copy.poster_thumb = '';
    return copy;
  });
}

export function nextMovieIdentity(movies) {
  var id = 0, num = 0;
  movies.forEach(function(m) {
    id = Math.max(id, Number(m.id) || 0);
    num = Math.max(num, Number(m.num) || 0);
  });
  return { id: id + 1, num: num + 1 };
}

export function hasTmdbMovie(movies, tmdbId) {
  if (!tmdbId) return false;
  return movies.some(function(m) {
    return Number(m.tmdbId || m.tmdb_id) === Number(tmdbId);
  });
}

export function createTmdbEntry(d) {
  if (!d || d.success === false || !d.id || !(d.title || d.original_title)) {
    throw new Error('TMDB nevrátil platné údaje filmu.');
  }
  var crew = d.credits && d.credits.crew || [];
  var director = crew.find(function(c) { return c.job === 'Director'; });
  var videos = d.videos && d.videos.results || [];
  var trailer = videos.find(function(v) { return v.type === 'Trailer' && v.site === 'YouTube'; })
    || videos.find(function(v) { return v.site === 'YouTube'; });
  var posterUrl = d.poster_path ? 'https://image.tmdb.org/t/p/w342' + d.poster_path : '';
  var imdbId = d.external_ids && d.external_ids.imdb_id;
  return {
    movie: {
      title: d.title || d.original_title,
      year: parseInt((d.release_date || '').slice(0, 4), 10) || 0,
      director: director ? director.name : '',
      cast: (d.credits && d.credits.cast || []).slice(0, 10).map(function(a) { return a.name; }).join(', '),
      genres: (d.genres || []).map(function(g) { return g.name; }),
      country: (d.production_countries || []).map(function(c) { return c.iso_3166_1 || c.name; }).join(', '),
      duration: d.runtime ? d.runtime + ' min' : '',
      description: (d.overview || '').substring(0, 500),
      poster_thumb: d.poster_path ? 'https://image.tmdb.org/t/p/w185' + d.poster_path : '',
      rating: 0,
      tmdbId: d.id,
      _tags: []
    },
    liveData: {
      pct: d.vote_average ? Math.round(d.vote_average * 10) : null,
      posterUrl: posterUrl,
      ytKey: trailer ? trailer.key : null,
      backdropUrl: d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : null,
      tmdbUrl: 'https://www.themoviedb.org/movie/' + d.id,
      imdbUrl: imdbId ? 'https://www.imdb.com/title/' + imdbId + '/' : null
    }
  };
}
