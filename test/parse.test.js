import { describe, it, expect } from 'vitest';
import { parseEMDB, parseCsvLine, parseCsfdPercent } from '../src/lib/parse.js';

describe('parseEMDB', () => {
  it('parses a single entry with meta, director, cast and description', () => {
    const text = [
      '1738: Kouzelná výměna (2026)',
      'Akčný, Sci-Fi - USA, 136 min',
      'Reziser: Jane Doe',
      'Obsadenie: John Smith, Mary Major',
      'Krásny popis filmu.',
      ''
    ].join('\n');
    const out = parseEMDB(text);
    expect(out).toHaveLength(1);
    const m = out[0];
    expect(m.num).toBe(1738);
    expect(m.title).toBe('Kouzelná výměna');
    expect(m.year).toBe(2026);
    expect(m.genres).toEqual(['Akčný', 'Sci-Fi']);
    expect(m.duration).toBe('136 min');
    expect(m.country).toBe('USA');
    expect(m.director).toBe('Jane Doe');
    expect(m.cast).toBe('John Smith, Mary Major');
    expect(m.description).toContain('Krásny popis');
  });

  it('returns empty array when there are no entries', () => {
    expect(parseEMDB('just some prose without entries')).toEqual([]);
  });
});

describe('parseCsvLine', () => {
  it('splits simple comma fields', () => {
    expect(parseCsvLine('1,2,3')).toEqual(['1', '2', '3']);
  });
  it('keeps commas inside quotes and unescapes ""', () => {
    expect(parseCsvLine('"a,b","c""d"')).toEqual(['a,b', 'c"d']);
  });
});

describe('parseCsfdPercent', () => {
  it('extracts a valid 0-100 percentage', () => {
    expect(parseCsfdPercent('85%')).toBe(85);
    expect(parseCsfdPercent('  0 ')).toBe(0);
  });
  it('rejects out-of-range or empty values', () => {
    expect(parseCsfdPercent('')).toBeNull();
    expect(parseCsfdPercent(null)).toBeNull();
    expect(parseCsfdPercent('abc')).toBeNull();
    expect(parseCsfdPercent('250')).toBeNull();
  });
});
