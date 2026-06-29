import { describe, it, expect } from 'vitest';
import { buildCorePayload, buildLivePayload, mergeSyncPayloads, SYNC_VERSION } from '../src/lib/sync-helpers.js';

describe('buildCorePayload', () => {
  it('strips base64 posters but keeps URL posters and collections', () => {
    const core = buildCorePayload({
      movies: [
        { id: 1, title: 'A', poster_thumb: 'data:image/jpeg;base64,XXXX' },
        { id: 2, title: 'B', poster_thumb: 'https://image.tmdb.org/x.jpg' }
      ],
      favourites: [1], watchlist: [2], watched: [], watchedDates: { 1: '2026-01-01' }
    });
    expect(core.version).toBe(SYNC_VERSION);
    expect(core.movies[0].poster_thumb).toBe('');
    expect(core.movies[1].poster_thumb).toBe('https://image.tmdb.org/x.jpg');
    expect(core.favourites).toEqual([1]);
    expect(core).not.toHaveProperty('liveCache');
  });
});

describe('buildLivePayload', () => {
  it('wraps liveCache with version metadata', () => {
    const live = buildLivePayload({ 1: { pct: 88 } });
    expect(live.version).toBe(SYNC_VERSION);
    expect(live.liveCache[1].pct).toBe(88);
  });
});

describe('mergeSyncPayloads', () => {
  it('prefers the separate live payload for liveCache', () => {
    const out = mergeSyncPayloads(
      { movies: [{ id: 1 }], favourites: [1], liveCache: { 1: { pct: 1 } } },
      { liveCache: { 1: { pct: 99 } } }
    );
    expect(out.movies).toHaveLength(1);
    expect(out.favourites).toEqual([1]);
    expect(out.liveCache[1].pct).toBe(99);
  });

  it('falls back to embedded liveCache (v1 format) when no live payload', () => {
    const out = mergeSyncPayloads({ movies: [], liveCache: { 5: { pct: 50 } } }, null);
    expect(out.liveCache[5].pct).toBe(50);
  });

  it('tolerates empty/missing inputs', () => {
    const out = mergeSyncPayloads(null, null);
    expect(out.movies).toEqual([]);
    expect(out.liveCache).toEqual({});
    expect(out.watchedDates).toEqual({});
  });
});
