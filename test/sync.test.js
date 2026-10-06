import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/state.js', () => ({ S: {} }));

import { S } from '../src/state.js';
import '../src/storage.js';
import '../src/sync.js';

let localStorage;

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function remote(movies = [{ id: 1, num: 1, title: 'Remote', year: 2016 }]) {
  return [
    { status: 200, etag: '"core"', payload: { movies, favourites: [1], watchlist: [], watched: [] } },
    { status: 200, etag: '"live"', payload: { liveCache: { 1: { pct: 80 } } } }
  ];
}

beforeEach(() => {
  const values = new Map();
  localStorage = {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn(key => values.delete(key))
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.assign(S, {
    SK: 'movies', LK: 'live', FK: 'favs', WK: 'watchlist', VK: 'watched', VDK: 'dates',
    SYNC_PENDING_KEY: 'pending', GH_ETAG_KEY: 'etags', GH_FILE: 'data.json', GH_LIVE_FILE: 'data-live.json',
    _syncRevision: '', _syncEpoch: 0, _ghPullRunning: false, _ghPullPromise: null,
    ghPushInProgress: false, _ghPushPromise: null, ghToken: 'unit-test-only',
    all: [{ id: 1, num: 1, title: 'Original' }], liveCache: {},
    favs: new Set(), wl: new Set(), watched: new Set(), watchedDates: {},
    prefs: { autoPush: false }, autoPushTimer: null,
    toast: vi.fn(), invalidateSearch: vi.fn(), buildFuse: vi.fn(), renderAll: vi.fn(),
    ghSetStatus: vi.fn(), ghPullProgress: vi.fn(),
    ghFetchFile: vi.fn(), ghPutFile: vi.fn().mockResolvedValue({ ok: true }),
    ghSetEtag: vi.fn()
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('protecting local changes during GitHub pull', () => {
  it('does not replace a durable pending local addition, including after restart', async () => {
    S.all.push({ id: 2, num: 2, title: 'Local' });
    S.saveMovies();
    S._syncRevision = '';
    expect(await S.ghPull()).toBe(false);
    expect(S.ghFetchFile).not.toHaveBeenCalled();
    expect(S.all).toHaveLength(2);
    expect(S.ghSetStatus).toHaveBeenCalledWith(expect.stringContaining('Lokálne'), 'err');
  });

  it('preserves local additions if the user cancels an explicit replacement', async () => {
    S.saveMovies();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    expect(await S.ghPull({ manual: true })).toBe(false);
    expect(S.ghFetchFile).not.toHaveBeenCalled();
    expect(S.getSyncRevision()).not.toBe('');
  });

  it('allows an explicitly confirmed remote replacement without permanently blocking read-only users', async () => {
    S.saveMovies();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const response = remote();
    S.ghFetchFile.mockResolvedValueOnce(response[0]).mockResolvedValueOnce(response[1]);
    expect(await S.ghPull({ manual: true })).toBe(true);
    expect(S.all).toEqual(response[0].payload.movies);
    expect(S.getSyncRevision()).toBe('');
    expect(S.ghFetchFile).toHaveBeenNthCalledWith(1, S.GH_FILE, false);
    expect(S.ghFetchFile).toHaveBeenNthCalledWith(2, S.GH_LIVE_FILE, false);
  });

  it('discards an older in-flight pull if a local movie was added during the download', async () => {
    const download = deferred();
    S.ghFetchFile.mockReturnValueOnce(download.promise).mockResolvedValueOnce(remote()[1]);
    const pull = S.ghPull();
    S.all.push({ id: 2, num: 2, title: 'Local' });
    S.saveMovies();
    download.resolve(remote()[0]);
    expect(await pull).toBe(false);
    expect(S.all.map(movie => movie.title)).toEqual(['Original', 'Local']);
    expect(S.ghSetEtag).not.toHaveBeenCalled();
    expect(S._ghPullRunning).toBe(false);
  });

  it('does not let a pre-upload pull overwrite an already completed upload', async () => {
    const download = deferred();
    S.ghFetchFile.mockReturnValueOnce(download.promise).mockResolvedValueOnce(remote()[1]);
    const pull = S.ghPull();
    S.all.push({ id: 2, num: 2, title: 'Local' });
    S.saveMovies();
    expect(await S.ghPush()).toBe(true);
    expect(S.getSyncRevision()).toBe('');
    download.resolve(remote()[0]);
    expect(await pull).toBe(false);
    expect(S.all).toHaveLength(2);
  });

  it('still protects changes made after an explicit replacement was confirmed', async () => {
    S.saveMovies();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const download = deferred();
    S.ghFetchFile.mockReturnValueOnce(download.promise).mockResolvedValueOnce(remote()[1]);
    const pull = S.ghPull({ manual: true });
    S.all.push({ id: 2, num: 2, title: 'Added after confirmation' });
    S.saveMovies();
    download.resolve(remote()[0]);
    expect(await pull).toBe(false);
    expect(S.all).toHaveLength(2);
    expect(S.getSyncRevision()).not.toBe('');
  });

  it('does not pull while an upload is active', async () => {
    const upload = deferred();
    S.ghPutFile.mockReturnValueOnce(upload.promise);
    const push = S.ghPush();
    expect(await S.ghPull()).toBe(false);
    expect(S.ghFetchFile).not.toHaveBeenCalled();
    upload.resolve({ ok: true });
    await push;
  });

  it('applies and persists an unmodified remote library without creating a pending edit', async () => {
    const response = remote();
    S.ghFetchFile.mockResolvedValueOnce(response[0]).mockResolvedValueOnce(response[1]);
    localStorage.setItem('mdb_empty', '1');
    expect(await S.ghPull()).toBe(true);
    expect(S.loadMovies()).toEqual(response[0].payload.movies);
    expect(S.getSyncRevision()).toBe('');
    expect(localStorage.getItem('mdb_empty')).toBeNull();
    expect(S.ghSetEtag).toHaveBeenCalledTimes(2);
  });

  it('does not cache ETags or claim durable success when a downloaded library cannot be saved', async () => {
    const response = remote();
    S.ghFetchFile.mockResolvedValueOnce(response[0]).mockResolvedValueOnce(response[1]);
    localStorage.setItem.mockImplementation(key => {
      if (key === S.SK) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
    });
    expect(await S.ghPull()).toBe(false);
    expect(S.ghSetEtag).not.toHaveBeenCalled();
    expect(S.ghSetStatus).toHaveBeenLastCalledWith(expect.any(String), 'err');
  });

  it('keeps the conditional-GET fast path without replacing local data', async () => {
    S.ghFetchFile.mockResolvedValue({ status: 304 });
    expect(await S.ghPull()).toBe(true);
    expect(S.all[0].title).toBe('Original');
    expect(S.renderAll).not.toHaveBeenCalled();
    expect(S._ghPullRunning).toBe(false);
  });
});
  it('does not trust old ETags when no local movie library survived', async () => {
    S.all = [];
    const response = remote();
    S.ghFetchFile.mockResolvedValueOnce(response[0]).mockResolvedValueOnce(response[1]);
    expect(await S.ghPull()).toBe(true);
    expect(S.ghFetchFile).toHaveBeenNthCalledWith(1, S.GH_FILE, false);
    expect(S.ghFetchFile).toHaveBeenNthCalledWith(2, S.GH_LIVE_FILE, false);
    expect(S.all).toHaveLength(1);
  });


describe('acknowledging the actual uploaded snapshot', () => {
  it('clears the pending revision after the critical core write and invalidates ETags', async () => {
    S.saveMovies();
    const live = deferred();
    S.ghPutFile.mockResolvedValueOnce({ ok: true }).mockReturnValueOnce(live.promise);
    const push = S.ghPush();
    await vi.waitFor(() => expect(S.ghPutFile).toHaveBeenCalledTimes(2));
    expect(S.getSyncRevision()).toBe('');
    expect(localStorage.removeItem).toHaveBeenCalledWith(S.GH_ETAG_KEY);
    live.resolve({ ok: true });
    expect(await push).toBe(true);
  });

  it('retains newer local edits when they were not part of the upload', async () => {
    S.saveMovies();
    const upload = deferred();
    S.ghPutFile.mockReturnValueOnce(upload.promise);
    const push = S.ghPush();
    S.all.push({ id: 2, num: 2, title: 'Added while uploading' });
    S.saveMovies();
    const revision = S.getSyncRevision();
    upload.resolve({ ok: true });
    expect(await push).toBe(true);
    expect(S.getSyncRevision()).toBe(revision);
    expect(JSON.parse(S.ghPutFile.mock.calls[0][1]).movies).toHaveLength(1);
    expect(S.ghSetStatus).toHaveBeenLastCalledWith(expect.stringContaining('1 filmov'), 'ok');
    expect(await S.ghPull()).toBe(false);
  });

  it('retains the pending library when the core upload fails', async () => {
    S.saveMovies();
    const revision = S.getSyncRevision();
    S.ghPutFile.mockRejectedValueOnce(new Error('Permission denied'));
    expect(await S.ghPush()).toBe(false);
    expect(S.getSyncRevision()).toBe(revision);
    expect(S.ghPushInProgress).toBe(false);
  });

  it('acknowledges a saved core even if the separately uploaded media cache fails', async () => {
    S.saveMovies();
    S.ghPutFile.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Media write failed'));
    expect(await S.ghPush()).toBe(false);
    expect(S.getSyncRevision()).toBe('');
    expect(S.ghPushInProgress).toBe(false);
  });
});

describe('pending auto-sync after reload', () => {
  it('resumes a pending upload only with a saved token and auto-push enabled', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { getElementById: () => null });
    localStorage.setItem(S.SYNC_PENDING_KEY, 'pending-before-reload');
    localStorage.setItem('mdb_gh_token', 'unit-test-only');
    S.prefs.autoPush = true;
    S.initGhSync();
    expect(S.ghPutFile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(S.ghPutFile).toHaveBeenCalledTimes(2);
    expect(S.getSyncRevision()).toBe('');
  });

  it.each([false, true])('does not upload without a token (auto-push %s)', async autoPush => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { getElementById: () => null });
    localStorage.setItem(S.SYNC_PENDING_KEY, 'pending-before-reload');
    S.prefs.autoPush = autoPush;
    S.initGhSync();
    await vi.advanceTimersByTimeAsync(5000);
    expect(S.ghPutFile).not.toHaveBeenCalled();
    expect(S.getSyncRevision()).toBe('pending-before-reload');
  });

  it('respects disabled auto-push even when a token is saved', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { getElementById: () => null });
    localStorage.setItem(S.SYNC_PENDING_KEY, 'pending-before-reload');
    localStorage.setItem('mdb_gh_token', 'unit-test-only');
    S.initGhSync();
    await vi.advanceTimersByTimeAsync(5000);
    expect(S.ghPutFile).not.toHaveBeenCalled();
    expect(S.getSyncRevision()).toBe('pending-before-reload');
  });
});
