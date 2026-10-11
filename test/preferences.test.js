import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, normalizeRatingSource } from '../src/lib/preferences.js';

const source = readFileSync(new URL('../src/state.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace('export const S', 'const S') + '\nS.ratingSource;';
const keySource = source.replace(/\nS\.ratingSource;$/, '\n({tmdbCleared:S.tmdbKey === "", omdbCleared:S.omdbKey === "", smbCleared:S.smbBase === ""});');

describe('rating preference defaults', () => {
  it.each([null, '', undefined, 'unknown'])('uses ČSFD when no valid choice is saved: %s', value => {
    expect(normalizeRatingSource(value)).toBe('csfd');
  });
  it.each(['csfd', 'tmdb', 'imdb'])('preserves an explicit saved source: %s', value => {
    expect(normalizeRatingSource(value)).toBe(value);
  });
  it.each([null, 'tmdb', 'imdb', 'csfd'])('initializes application state from the saved choice: %s', saved => {
    const result = runInNewContext(source, {
      DEFAULT_PREFS, normalizeRatingSource,
      localStorage: { getItem: key => key === 'mdb_ratingsrc' ? saved : null },
      window: { matchMedia: () => ({}) }, navigator: { userAgent: '' }
    });
    expect(result).toBe(saved || 'csfd');
  });
  it('preserves explicitly cleared API keys and SMB address on restart', () => {
    const cleared = new Set(['tmdb_key', 'omdb_key', 'mdb_smb_base']);
    const result = runInNewContext(keySource, {
      DEFAULT_PREFS, normalizeRatingSource,
      localStorage: { getItem: key => cleared.has(key) ? '' : null },
      window: { matchMedia: () => ({}) }, navigator: { userAgent: '' }
    });
    expect(result).toEqual({ tmdbCleared: true, omdbCleared: true, smbCleared: true });
  });
});
