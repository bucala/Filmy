import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLibrarySearch, createDebouncedTask, pageRange, needsMoreCards } from '../src/lib/browse.js';

function setupSearch(movies, results = [], limit = 8) {
  const fuzzy = vi.fn(() => results);
  const createIndex = vi.fn(() => ({ search: fuzzy }));
  return { engine: createLibrarySearch(createIndex, limit), createIndex, fuzzy, movies };
}

describe('library search', () => {
  const movies = [
    { id: 1, title: 'Arrival', year: 2016, director: 'Denis Villeneuve', genres: ['Sci-Fi'], _tags: ['večer'] },
    { id: 2, title: 'Dune', year: 2021, director: 'Denis Villeneuve', genres: ['Drama'], description: 'Arrival' }
  ];

  it('keeps browsing and exact search off the fuzzy-index path', () => {
    const { engine, createIndex } = setupSearch(movies);
    expect(engine.search(movies, movies, '').items).toEqual(movies);
    expect(engine.search(movies, movies, ' ARRIVAL ').items).toEqual([movies[0]]);
    expect(createIndex).not.toHaveBeenCalled();
  });

  it.each(['denis', '2016', 'sci-fi', 'VEČER'])('matches the existing exact fields for %s', query => {
    const { engine } = setupSearch(movies);
    const result = engine.search(movies, [movies[0]], query);
    expect(result.mode).toBe('exact');
    expect(result.items).toEqual([movies[0]]);
  });

  it('does not change an exact search into a description match', () => {
    const { engine } = setupSearch(movies);
    expect(engine.search(movies, movies, 'arrival').items).toEqual([movies[0]]);
  });

  it('uses exact-first within the filtered pool, not across the whole library', () => {
    const matches = [{ key: 'description', indices: [[0, 6]] }];
    const { engine, createIndex } = setupSearch(movies, [{ item: movies[1], matches }]);
    const result = engine.search(movies, [movies[1]], 'arrival');
    expect(result.items).toEqual([movies[1]]);
    expect(result.mode).toBe('fuzzy');
    expect(result.matches.get(2)).toBe(matches);
    expect(createIndex).toHaveBeenCalledWith(movies);
  });

  it('reuses a full-library index and cached results across collection/filter changes', () => {
    const matches = [{ key: 'title', indices: [[0, 4]] }];
    const { engine, createIndex, fuzzy } = setupSearch(movies, [
      { item: movies[0], matches }, { item: movies[1], matches: [] }
    ]);
    expect(engine.search(movies, movies, 'arival').items).toEqual(movies);
    const filtered = engine.search(movies, [movies[1]], ' ARIVAL ');
    expect(filtered.items).toEqual([movies[1]]);
    expect(filtered.matches.has(1)).toBe(false);
    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(fuzzy).toHaveBeenCalledTimes(1);
  });

  it('does not build an index for an empty collection', () => {
    const { engine, createIndex } = setupSearch(movies);
    expect(engine.search(movies, [], 'missing').items).toEqual([]);
    expect(createIndex).not.toHaveBeenCalled();
  });

  it('returns independent lists so sorting results cannot reorder the library or cache', () => {
    const { engine } = setupSearch(movies, movies.map(item => ({ item })));
    engine.search(movies, movies, '').items.reverse();
    engine.search(movies, movies, 'arival').items.reverse();
    expect(engine.search(movies, movies, 'arival').items).toEqual(movies);
    expect(movies[0].id).toBe(1);
  });

  it('invalidates cached text, fuzzy results and index after an in-place edit', () => {
    const editable = [{ id: 1, title: 'Old title' }];
    const { engine, createIndex } = setupSearch(editable);
    engine.search(editable, editable, 'unknown');
    editable[0].title = 'New title';
    engine.reset();
    expect(engine.search(editable, editable, 'new title').mode).toBe('exact');
    expect(engine.search(editable, editable, 'old title').items).toEqual([]);
    expect(createIndex).toHaveBeenCalledTimes(2);
  });

  it('invalidates automatically after replacing or extending a collection', () => {
    const original = [{ id: 1, title: 'Old' }];
    const { engine, createIndex } = setupSearch(original);
    engine.search(original, original, 'missing');
    const replacement = [{ id: 2, title: 'New' }];
    engine.search(replacement, replacement, 'missing');
    replacement.push({ id: 3, title: 'Added' });
    engine.search(replacement, replacement, 'missing');
    expect(createIndex.mock.calls.map(call => call[0])).toEqual([original, replacement, replacement]);
    expect(createIndex).toHaveBeenCalledTimes(3);
  });

  it('bounds the fuzzy-query cache and keeps recently used entries', () => {
    const { engine, fuzzy } = setupSearch(movies, [], 2);
    for (const query of ['one', 'two', 'one', 'three', 'one', 'two']) {
      engine.search(movies, movies, query);
    }
    expect(fuzzy).toHaveBeenCalledTimes(4);
  });
});

describe('search debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('runs only the latest request after the typing pause', () => {
    vi.useFakeTimers();
    const run = vi.fn(), pending = vi.fn();
    const task = createDebouncedTask(run, 180, pending);
    task.schedule();
    vi.advanceTimersByTime(100);
    task.schedule();
    vi.advanceTimersByTime(179);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('clear/reset cancels work rather than repainting stale results later', () => {
    vi.useFakeTimers();
    const run = vi.fn(), pending = vi.fn();
    const task = createDebouncedTask(run, 180, pending);
    task.schedule();
    task.cancel();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('Enter flushes once immediately and removes the queued callback', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const task = createDebouncedTask(run, 180);
    task.schedule();
    expect(task.flush()).toBe(true);
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
    expect(task.flush()).toBe(false);
  });
});

describe('incremental cards', () => {
  it('covers the library once, including the short final page', () => {
    expect(pageRange(0, 24, 50)).toEqual({ start: 0, end: 24 });
    expect(pageRange(1, 24, 50)).toEqual({ start: 24, end: 48 });
    expect(pageRange(2, 24, 50)).toEqual({ start: 48, end: 50 });
    expect(pageRange(3, 24, 50).start).toBeGreaterThanOrEqual(50);
  });

  it('fills a tall viewport before waiting for an impossible scroll event', () => {
    expect(needsMoreCards(0, 900, 600, 100)).toBe(true);
    expect(needsMoreCards(500, 600, 1200, 24)).toBe(true);
  });

  it('does not append into a hidden screen, far from the end, or after exhaustion', () => {
    expect(needsMoreCards(0, 0, 600, 24)).toBe(false);
    expect(needsMoreCards(0, 600, 2000, 24)).toBe(false);
    expect(needsMoreCards(900, 600, 1200, 0)).toBe(false);
  });
});
