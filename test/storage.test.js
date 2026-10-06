import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/state.js', () => ({ S: {} }));

import { S } from '../src/state.js';
import '../src/storage.js';
import '../src/settings.js';

let localStorage;

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn(key => values.delete(key))
  };
}

beforeEach(() => {
  localStorage = createStorage();
  vi.stubGlobal('localStorage', localStorage);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.assign(S, {
    SK: 'movies', LK: 'live', FK: 'favs', WK: 'watchlist', VK: 'watched', VDK: 'dates',
    SYNC_PENDING_KEY: 'pending',
    _syncRevision: '', _syncEpoch: 0,
    all: [], liveCache: {}, adminPending: null,
    toast: vi.fn(), invalidateSearch: vi.fn(), buildFuse: vi.fn(),
    renderAll: vi.fn(), scheduleAutoPush: vi.fn(), closeAdmin: vi.fn(),
    adminSetStatus: vi.fn()
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('loading saved movies', () => {
  it('restores a valid nonempty library despite a stale empty marker', () => {
    const movies = [{ id: 7, title: 'Arrival', year: '2016' }];
    localStorage.setItem(S.SK, JSON.stringify(movies));
    localStorage.setItem('mdb_empty', '1');
    expect(S.loadMovies()).toEqual([{ ...movies[0], year: 2016 }]);
    expect(localStorage.getItem('mdb_empty')).toBeNull();
    expect(S.getSyncRevision()).not.toBe('');
    expect(S.needsRecoveredLibraryReview()).toBe(true);
  });

  it('keeps an intentionally empty library empty', () => {
    localStorage.setItem(S.SK, '[]');
    localStorage.setItem('mdb_empty', '1');
    expect(S.loadMovies()).toEqual([]);
  });

  it.each(['null', '{}', '"invalid"', '{broken'])('rejects invalid stored data: %s', value => {
    localStorage.setItem(S.SK, value);
    expect(S.loadMovies()).toEqual([]);
  });
});

describe('durable saves', () => {
  it('returns success, clears the empty marker and marks movies pending sync', () => {
    localStorage.setItem('mdb_empty', '1');
    expect(S.safeSave(S.SK, '[{"id":1}]')).toBe(true);
    expect(localStorage.getItem('mdb_empty')).toBeNull();
    expect(S.getSyncRevision()).not.toBe('');
    expect(S.invalidateSearch).toHaveBeenCalledOnce();
  });

  it('does not mark a successfully applied remote snapshot as a local change', () => {
    expect(S.safeSave(S.SK, '[{"id":1}]', { synced: true })).toBe(true);
    expect(S.getSyncRevision()).toBe('');
  });

  it('tracks local collection changes but not unchanged values or media cache writes', () => {
    S.safeSave(S.FK, '[1]');
    const revision = S.getSyncRevision();
    S.safeSave(S.FK, '[1]');
    S.safeSave(S.LK, '{}');
    expect(S.getSyncRevision()).toBe(revision);
    S.safeSave(S.VK, '[1]');
    expect(S.getSyncRevision()).not.toBe(revision);
  });

  it('reports quota failures without pretending data was saved', () => {
    localStorage.setItem('mdb_empty', '1');
    localStorage.setItem.mockImplementation(() => {
      throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
    });
    expect(S.safeSave(S.SK, '[{"id":1}]')).toBe(false);
    expect(localStorage.getItem(S.SK)).toBeNull();
    expect(localStorage.getItem('mdb_empty')).toBe('1');
    expect(S.toast).toHaveBeenCalled();
  });

  it('does not write a new library if its reload-safe sync guard cannot be persisted', () => {
    localStorage.setItem.mockImplementation(key => {
      if (key === S.SYNC_PENDING_KEY) throw new Error('Full');
    });
    expect(S.safeSave(S.SK, '[{"id":1}]')).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalledWith(S.SK, '[{"id":1}]');
  });

  it('strips only base64 posters when saving the library', () => {
    S.all = [
      { id: 1, poster_thumb: 'data:image/jpeg;base64,AAAA' },
      { id: 2, poster_thumb: 'https://image.tmdb.org/poster.jpg' }
    ];
    expect(S.saveMovies()).toBe(true);
    expect(JSON.parse(localStorage.getItem(S.SK))).toEqual([
      { id: 1, poster_thumb: '' },
      { id: 2, poster_thumb: 'https://image.tmdb.org/poster.jpg' }
    ]);
    expect(S.all[0].poster_thumb).toContain('data:');
  });

  it('acknowledges only the uploaded revision and survives a page restart', () => {
    S.safeSave(S.SK, '[{"id":1}]');
    const uploaded = S.getSyncRevision();
    S.safeSave(S.SK, '[{"id":1},{"id":2}]');
    const current = S.getSyncRevision();
    S._syncRevision = '';
    expect(S.getSyncRevision()).toBe(current);
    expect(S.acknowledgeSync(uploaded)).toBe(false);
    expect(S.getSyncRevision()).toBe(current);
    expect(S.acknowledgeSync(current)).toBe(true);
    expect(S.getSyncRevision()).toBe('');
  });
});

describe('shared TMDB insertion', () => {
  const entry = {
    movie: { id: 1, num: 1, tmdbId: 100, title: 'Arrival', year: 2016 },
    liveData: { pct: 80, posterUrl: 'https://image.tmdb.org/arrival.jpg', ytKey: 'trailer' }
  };

  it('allocates independent ids and numbers at insertion, persists and schedules sync', () => {
    S.all = [{ id: 50, num: 2, title: 'Existing' }];
    localStorage.setItem('mdb_empty', '1');
    const added = S.insertMovie(entry);
    expect(added).toMatchObject({ id: 51, num: 3, tmdbId: 100 });
    expect(S.loadMovies()).toHaveLength(2);
    expect(localStorage.getItem('mdb_empty')).toBeNull();
    expect(S.liveCache[51].ytKey).toBe('trailer');
    expect(S.scheduleAutoPush).toHaveBeenCalledOnce();
    expect(entry.movie.id).toBe(1);
  });

  it('rejects duplicate TMDB identities from either legacy or current fields', () => {
    S.all = [{ id: 1, tmdb_id: 100 }];
    expect(S.insertMovie(entry)).toBeNull();
    expect(S.all).toHaveLength(1);
    expect(S.scheduleAutoPush).not.toHaveBeenCalled();
  });

  it('rolls back a failed movie save and never schedules an upload or reports success', () => {
    const original = { id: 5, num: 5, title: 'Existing' };
    S.all = [original];
    localStorage.setItem.mockImplementation((key) => {
      if (key === S.SK) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
    });
    expect(S.insertMovie(entry)).toBeNull();
    expect(S.all).toEqual([original]);
    expect(S.liveCache).toEqual({});
    expect(S.scheduleAutoPush).not.toHaveBeenCalled();
    expect(S.renderAll).not.toHaveBeenCalled();
  });

  it('routes admin insertion through the shared durable path and closes only on success', () => {
    S.adminPending = entry;
    S.adminAddMovie();
    expect(S.loadMovies()).toHaveLength(1);
    expect(S.closeAdmin).toHaveBeenCalledOnce();
    expect(S.scheduleAutoPush).toHaveBeenCalledOnce();
  });

  it('leaves the admin preview open when persistence fails', () => {
    S.adminPending = entry;
    localStorage.setItem.mockImplementation((key) => {
      if (key === S.SK) throw new Error('Storage unavailable');
    });
    S.adminAddMovie();
    expect(S.all).toEqual([]);
    expect(S.closeAdmin).not.toHaveBeenCalled();
    expect(S.adminSetStatus).toHaveBeenCalledWith(expect.any(String), 'err');
  });
});
