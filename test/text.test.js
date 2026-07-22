import { describe, it, expect } from 'vitest';
import { esc, hexDim, removeDiacritics, normalizeSlashes, buildMovieFilename, levenshtein, tmdbSrcset } from '../src/lib/text.js';

describe('esc', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(esc('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });
  it('stringifies non-strings', () => {
    expect(esc(42)).toBe('42');
    expect(esc(null)).toBe('null');
  });
});

describe('hexDim', () => {
  it('dims a hex colour to ~38%', () => {
    expect(hexDim('#ffffff')).toBe('#616161');
  });
  it('falls back when slicing throws', () => {
    expect(hexDim(null)).toBe('#6b5220');
  });
});

describe('removeDiacritics', () => {
  it('maps Slovak/Czech diacritics to ASCII', () => {
    expect(removeDiacritics('Žltý kôň Ľubomír')).toBe('Zlty kon Lubomir');
  });
  it('leaves ASCII untouched', () => {
    expect(removeDiacritics('Jack Ryan 2026')).toBe('Jack Ryan 2026');
  });
});

describe('normalizeSlashes', () => {
  it('converts backslashes and collapses duplicates', () => {
    expect(normalizeSlashes('W:\\\\Movies\\\\film.mkv')).toBe('W:/Movies/film.mkv');
  });
});

describe('buildMovieFilename', () => {
  it('builds a sanitized "YEAR - Title.mkv" name', () => {
    expect(buildMovieFilename({ title: 'Tom Clancy\'s: Jack Ryan', year: 2026 }))
      .toBe('2026 - Tom Clancy\'s Jack Ryan.mkv');
  });
  it('uses 0000 when year is missing', () => {
    expect(buildMovieFilename({ title: 'Test' })).toBe('0000 - Test.mkv');
  });
});

describe('tmdbSrcset', () => {
  it('builds a multi-size srcset from a w<N>-sized TMDB URL', () => {
    expect(tmdbSrcset('https://image.tmdb.org/t/p/w342/abc123.jpg')).toBe(
      'https://image.tmdb.org/t/p/w92/abc123.jpg 92w, https://image.tmdb.org/t/p/w154/abc123.jpg 154w, ' +
      'https://image.tmdb.org/t/p/w185/abc123.jpg 185w, https://image.tmdb.org/t/p/w342/abc123.jpg 342w, ' +
      'https://image.tmdb.org/t/p/w500/abc123.jpg 500w'
    );
  });
  it('returns an empty string for non-TMDB or size-less URLs', () => {
    expect(tmdbSrcset('data:image/jpeg;base64,XXXX')).toBe('');
    expect(tmdbSrcset('https://image.tmdb.org/t/p/original/abc123.jpg')).toBe('');
    expect(tmdbSrcset('')).toBe('');
    expect(tmdbSrcset(undefined)).toBe('');
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('film', 'film')).toBe(0);
  });
  it('honours maxDist early-out', () => {
    expect(levenshtein('abcdef', 'uvwxyz', 2)).toBeGreaterThan(2);
  });
});
