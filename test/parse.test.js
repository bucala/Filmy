import { describe, it, expect } from 'vitest';
import { parseEMDB, parseCsvLine, parseCsfdPercent, parseEmdbCsv } from '../src/lib/parse.js';

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
  it('splits on a custom delimiter', () => {
    expect(parseCsvLine('1;2;3', ';')).toEqual(['1', '2', '3']);
  });
  it('keeps commas intact when the delimiter is ;', () => {
    expect(parseCsvLine('916;Akčný, Dobrodružný;W:\\Movies', ';'))
      .toEqual(['916', 'Akčný, Dobrodružný', 'W:\\Movies']);
  });
});

describe('parseEmdbCsv', () => {
  it('parses EMDB\'s real single-movie CSV export (č.;Obal;Titul;Rok;Štát;Žánre;Umiestnenie)', () => {
    const text = 'č.;Obal;Titul;Rok;Štát;Žánre;Umiestnenie\r\n' +
      '916;Neznámy;Mortal Kombat;2021;Australia;Akčný, Rozprávka, Dobrodružný;W:\\Movies\\2021 - Mortal Kombat.mkv\r\n';
    const out = parseEmdbCsv(text);
    expect(out).toHaveLength(1);
    const m = out[0];
    expect(m.num).toBe(916);
    expect(m.title).toBe('Mortal Kombat');
    expect(m.year).toBe(2021);
    expect(m.country).toBe('Australia');
    expect(m.genres).toEqual(['Akčný', 'Rozprávka', 'Dobrodružný']);
    expect(m._localPath).toBe('W:\\Movies\\2021 - Mortal Kombat.mkv');
    // Fields EMDB's CSV doesn't carry stay blank so the merge never clobbers them.
    expect(m.director).toBe('');
    expect(m.poster_thumb).toBe('');
    expect(m.tmdbId).toBeNull();
  });

  it('parses multiple rows and skips a row with no parseable number', () => {
    const text = [
      'č.;Obal;Titul;Rok;Štát;Žánre;Umiestnenie',
      '1;Neznámy;Alpha;2020;USA;Akčný;C:\\a.mkv',
      ';Neznámy;NoNumber;2021;USA;Dráma;C:\\b.mkv',
      '3;Neznámy;Gamma;2022;;;C:\\c.mkv'
    ].join('\r\n');
    const out = parseEmdbCsv(text);
    expect(out.map(m => m.num)).toEqual([1, 3]);
    // Blank Štát/Žánre columns degrade to empty string / empty array, not a crash.
    expect(out[1].country).toBe('');
    expect(out[1].genres).toEqual([]);
  });

  it('tolerates a comma-delimited variant with the same header names', () => {
    const text = 'Č.,Titul,Rok,Umiestnenie\n42,Beta,2019,D:\\Beta.mkv\n';
    const out = parseEmdbCsv(text);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ num: 42, title: 'Beta', year: 2019, _localPath: 'D:\\Beta.mkv' });
  });

  it('falls back to the observed column order when headers are unrecognized', () => {
    const text = '916;Neznámy;Mortal Kombat;2021;Australia;Akčný;W:\\Movies\\mk.mkv';
    const out = parseEmdbCsv(text);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Mortal Kombat');
    expect(out[0]._localPath).toBe('W:\\Movies\\mk.mkv');
  });

  it('returns an empty array for blank input', () => {
    expect(parseEmdbCsv('')).toEqual([]);
    expect(parseEmdbCsv('   \n  \n')).toEqual([]);
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
