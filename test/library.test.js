import { describe, expect, it } from 'vitest';
import { createTmdbEntry, hasTmdbMovie, moviesForStorage, nextMovieIdentity, parseStoredMovies } from '../src/lib/library.js';

describe('movie identities', () => {
  it('allocates ids independently of numbers after deletion or reordering', () => {
    expect(nextMovieIdentity([{ id: 100, num: 2 }, { id: 5, num: 9 }])).toEqual({ id: 101, num: 10 });
    expect(nextMovieIdentity([])).toEqual({ id: 1, num: 1 });
  });

  it('accepts numeric strings in legacy library records', () => {
    expect(nextMovieIdentity([{ id: '12', num: '4' }])).toEqual({ id: 13, num: 5 });
  });

  it('recognizes both TMDB fields but never confuses a local id with a TMDB id', () => {
    const movies = [{ id: 100, tmdbId: 200 }, { id: 101, tmdb_id: '300' }];
    expect(hasTmdbMovie(movies, '200')).toBe(true);
    expect(hasTmdbMovie(movies, 300)).toBe(true);
    expect(hasTmdbMovie(movies, 100)).toBe(false);
    expect(hasTmdbMovie(movies, undefined)).toBe(false);
  });
});

describe('movie persistence shaping', () => {
  it('rejects non-movie entries and converts years without mutating the source', () => {
    expect(parseStoredMovies('[null]')).toEqual([]);
    expect(parseStoredMovies('[[]]')).toEqual([]);
    expect(parseStoredMovies('[{"id":1,"year":"2024"},{"id":2}]')).toEqual([
      { id: 1, year: 2024 }, { id: 2, year: 0 }
    ]);
  });

  it('keeps movie metadata and URL posters while stripping large base64 posters', () => {
    const movies = [
      { id: 1, tmdbId: 5, poster_thumb: 'data:image/png;base64,AA', _tags: ['Sci-fi'] },
      { id: 2, poster_thumb: 'https://image.tmdb.org/poster.jpg' }
    ];
    const stored = moviesForStorage(movies);
    expect(stored[0]).toEqual({ ...movies[0], poster_thumb: '' });
    expect(stored[1]).toEqual(movies[1]);
    expect(movies[0].poster_thumb).toContain('data:');
  });
});

describe('shared TMDB metadata', () => {
  it('uses the same canonical movie and media fields for quick-add and admin', () => {
    const entry = createTmdbEntry({
      id: 100, title: 'Arrival', release_date: '2016-11-10', runtime: 116,
      vote_average: 8, poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg',
      overview: 'A visitor arrives.', production_countries: [{ iso_3166_1: 'US', name: 'USA' }],
      genres: [{ name: 'Science Fiction' }],
      credits: { cast: [{ name: 'Amy Adams' }], crew: [{ job: 'Director', name: 'Denis Villeneuve' }] },
      videos: { results: [{ site: 'YouTube', type: 'Teaser', key: 'teaser' }, { site: 'YouTube', type: 'Trailer', key: 'trailer' }] },
      external_ids: { imdb_id: 'tt2543164' }
    });
    expect(entry.movie).toMatchObject({
      tmdbId: 100, year: 2016, duration: '116 min', director: 'Denis Villeneuve',
      cast: 'Amy Adams', country: 'US', description: 'A visitor arrives.',
      genres: ['Science Fiction']
    });
    expect(entry.liveData).toMatchObject({
      pct: 80, ytKey: 'trailer', backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      imdbUrl: 'https://www.imdb.com/title/tt2543164/'
    });
    expect(entry.movie).not.toHaveProperty('id');
    expect(entry.movie).not.toHaveProperty('tmdb_id');
  });

  it('tolerates absent optional TMDB metadata', () => {
    const entry = createTmdbEntry({ id: 1, original_title: 'Movie' });
    expect(entry.movie).toMatchObject({ title: 'Movie', year: 0, genres: [], duration: '' });
    expect(entry.liveData).toMatchObject({ pct: null, ytKey: null, posterUrl: '' });
  });

  it.each([null, { success: false }, { id: 1 }])('rejects invalid TMDB responses: %j', response => {
    expect(() => createTmdbEntry(response)).toThrow('TMDB');
  });
});
