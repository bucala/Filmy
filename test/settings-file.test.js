import { describe, expect, it, vi } from 'vitest';
import { MAX_SETTINGS_BYTES, SETTINGS_STORAGE_KEYS, parseSettingsFile, serializeSettingsFile, storeSettings, validateSettings } from '../src/lib/settings-file.js';
import { memoryStorage, settingsFixture } from './fixtures/settings.js';

const file = settings => serializeSettingsFile(settings, 'test', new Date('2026-10-09T12:00:00Z'));

describe('settings-only file format', () => {
  it('round-trips every allowed setting, including credentials, appearance and sources', () => {
    const settings = settingsFixture();
    const content = file(settings);
    expect(parseSettingsFile(content)).toEqual(settings);
    expect(Object.keys(JSON.parse(content))).toEqual(['format', 'version', 'appVersion', 'exportedAt', 'settings']);
    expect(JSON.parse(content).exportedAt).toBe('2026-10-09T12:00:00.000Z');
  });

  it('accepts a UTF-8 BOM and returns an independent validated snapshot', () => {
    const settings = settingsFixture();
    expect(parseSettingsFile('\uFEFF' + file(settings))).toEqual(settings);
    const clean = validateSettings(settings);
    clean.preferences.view = 'list'; clean.smbSources[0].name = 'Changed';
    expect(settings.preferences.view).toBe('posterwall');
    expect(settings.smbSources[0].name).toBe('Filmy');
  });

  it.each(['{bad', '[]', 'null', '{"movies":[{"title":"Film"}],"liveCache":{}}'])(
    'rejects malformed files and film backups: %s', content => {
      expect(() => parseSettingsFile(content)).toThrow('platné nastavenia');
    }
  );

  it.each([
    f => { f.format = 'filmy-backup'; }, f => { f.version = 2; },
    f => { f.movies = []; }, f => { delete f.settings.debugMode; },
    f => { f.settings.movies = []; }, f => { f.settings.preferences.autoPush = 'true'; },
    f => { f.settings.preferences.view = 'unknown'; }, f => { f.settings.preferences.sort = 'unknown'; },
    f => { f.settings.ratingSource = 'unknown'; }, f => { f.settings.playerProto = 'javascript'; },
    f => { f.settings.androidPlayer = 'arbitrary-package'; }, f => { f.settings.smbBase = 'https://evil.example'; },
    f => { f.settings.smbSources = [{ name: 'Source', url: 'file:///etc/passwd' }]; },
    f => { f.settings.smbSources[0].movies = []; }, f => { f.settings.smbMap['X:\\'] = 'javascript:alert(1)'; },
    f => { f.settings.accent.gold = 'red; background:url(https://evil.example)'; },
    f => { f.settings.csfdMatcherUrl = 'javascript:alert(1)'; },
    f => { f.settings.githubToken = 'test\nkey'; }, f => { f.settings.portableMode = 'execute'; },
    f => { f.settings.debugMode = 1; }
  ])('rejects unknown, incomplete, unsafe or mistyped settings', change => {
    const document = JSON.parse(file(settingsFixture()));
    change(document);
    expect(() => parseSettingsFile(JSON.stringify(document))).toThrow('platné nastavenia');
  });

  it('rejects prototype pollution at each configurable object boundary', () => {
    for (const location of ['', 'settings', 'settings.preferences', 'settings.smbMap']) {
      const document = JSON.parse(file(settingsFixture()));
      let target = document;
      if (location) for (const part of location.split('.')) target = target[part];
      Object.defineProperty(target, '__proto__', { value: { polluted: true }, enumerable: true });
      expect(() => parseSettingsFile(JSON.stringify(document))).toThrow();
    }
    expect({}.polluted).toBeUndefined();
    const settings = settingsFixture({ smbMap: JSON.parse('{"constructor":"smb://nas/Movies/"}') });
    expect(() => validateSettings(settings)).toThrow();
  });

  it('limits bytes rather than JavaScript character count and bounds aggregate collections', () => {
    expect(() => parseSettingsFile('á'.repeat(MAX_SETTINGS_BYTES / 2 + 1))).toThrow('príliš veľký');
    expect(() => validateSettings(settingsFixture({ smbSources: Array.from({ length: 129 }, () => ({ name: 'Source', url: 'smb://nas/Movies/' })) }))).toThrow();
    const smbMap = Object.fromEntries(Array.from({ length: 128 }, (_, i) => ['Path' + i, 'smb://nas/' + 'a'.repeat(8100)]));
    expect(() => file(settingsFixture({ smbMap }))).toThrow('príliš veľký');
  });

  it('supports cleared keys, no custom accent and SMB credentials without coercing values', () => {
    const settings = settingsFixture({
      tmdbKey: '', omdbKey: '', githubToken: '', accent: null, smbBase: 'smb://demo:example@nas/Movies/'
    });
    expect(parseSettingsFile(file(settings))).toEqual(settings);
  });
});

describe('settings storage isolation and failure handling', () => {
  it('writes only the settings allowlist and leaves all movie and sync data byte-identical', () => {
    const original = {
      mdb_v5: '{"movies":[{"id":1}]}', mdb_live: '{"1":{"pct":80}}', mdb_favs: '[1]',
      mdb_watchlist: '[1]', mdb_watched: '[1]', mdb_watched_dates: '{"1":"2026-01-01"}',
      mdb_sync_pending: 'pending-revision', mdb_gh_etags: '{"core":"etag"}', copy_permissions: 'untouched'
    };
    const storage = memoryStorage(original);
    expect(storeSettings(storage, settingsFixture())).toEqual(settingsFixture());
    expect(storage.writes.every(key => Object.values(SETTINGS_STORAGE_KEYS).includes(key))).toBe(true);
    for (const [key, value] of Object.entries(original)) expect(storage.getItem(key)).toBe(value);
    expect(JSON.parse(storage.getItem('mdb_prefs'))).toEqual(settingsFixture().preferences);
    expect(storage.getItem('mdb_auto_pull')).toBe('0');
    expect(storage.getItem('mdb_debug_mode')).toBe('1');
    expect(storage.getItem('mdb_gh_token')).toBe('test-token');
  });

  it('validates the whole document before the first storage write', () => {
    const storage = memoryStorage();
    expect(() => storeSettings(storage, settingsFixture({ movies: [] }))).toThrow();
    expect(storage.writes).toEqual([]);
  });

  it('rolls back already changed settings if a write fails', () => {
    const storage = memoryStorage({ mdb_prefs: '{"old":true}', mdb_accent: '{"gold":"#000000"}', mdb_v5: 'keep' });
    const original = new Map(storage.values);
    const set = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementationOnce(set).mockImplementationOnce(set)
      .mockImplementationOnce(() => { throw new Error('Quota exceeded'); }).mockImplementation(set);
    expect(() => storeSettings(storage, settingsFixture())).toThrow('nepodarilo uložiť');
    expect(storage.values).toEqual(original);
  });

  it('reports unavailable storage without starting writes', () => {
    const storage = memoryStorage();
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('Storage denied'); });
    expect(() => storeSettings(storage, settingsFixture())).toThrow();
    expect(storage.writes).toEqual([]);
  });

  it('stores explicitly empty API keys and removes a null accent', () => {
    const storage = memoryStorage({ mdb_accent: '{"gold":"#000000"}', tmdb_key: 'old', omdb_key: 'old' });
    storeSettings(storage, settingsFixture({ tmdbKey: '', omdbKey: '', accent: null }));
    expect(storage.getItem('tmdb_key')).toBe('');
    expect(storage.getItem('omdb_key')).toBe('');
    expect(storage.getItem('mdb_accent')).toBeNull();
  });
});
