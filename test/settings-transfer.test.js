import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSettingsFile, serializeSettingsFile, storeSettings } from '../src/lib/settings-file.js';
import { memoryStorage, settingsFixture } from './fixtures/settings.js';

vi.mock('../src/state.js', () => ({ S: {} }));
import { S } from '../src/state.js';
import '../src/ui.js';
import '../src/settings-transfer.js';

const ui = { applyTheme: S.applyTheme, applyAccentColor: S.applyAccentColor, loadPrefs: S.loadPrefs };
let storage, nodes, groups, links;
const movieStorage = {
  mdb_v5: '[{"id":7,"title":"Original"}]', mdb_live: '{"7":{"pct":80}}',
  mdb_favs: '[7]', mdb_watchlist: '[7]', mdb_watched: '[7]', mdb_watched_dates: '{"7":"2026-01-01"}',
  mdb_sync_pending: 'local-revision', mdb_gh_etags: 'existing-etags', copy_permissions: 'existing-grant'
};
function node(dataset = {}) {
  const classes = new Set(), attributes = new Map(), properties = new Map(), listeners = new Map();
  return {
    dataset, classes, attributes, listeners, value: '', textContent: '', className: '', disabled: false,
    style: { setProperty: (key, value) => properties.set(key, value), getPropertyValue: key => properties.get(key) || '' },
    classList: {
      add: key => classes.add(key), remove: key => classes.delete(key),
      toggle(key, value) { if (value) classes.add(key); else classes.delete(key); }
    },
    setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
    addEventListener: (type, callback) => listeners.set(type, callback),
    click: vi.fn(), remove: vi.fn()
  };
}
const content = settings => serializeSettingsFile(settings, 'test');

beforeEach(() => {
  vi.useFakeTimers();
  const settings = settingsFixture();
  storage = memoryStorage(movieStorage);
  storeSettings(storage, settings); storage.writes.length = 0;
  vi.stubGlobal('localStorage', storage);
  nodes = new Map(); groups = new Map(); links = [];
  for (const id of [
    'settBtnSaveAll', 'settBtnLoadSettings', 'settingsFileInp', 'saveAllSt',
    'tmdbKeyInp', 'omdbKeyInp', 'ghTokenInp', 'smbPathInp', 'localPathInp', 'csfdMatcherUrlInp',
    'portableMpcInp', 'portableVlcInp', 'autoPullTog', 'autoPushTog', 'showRecentTog', 'debugModeTog',
    'ghTokenSt', 'tmdbKeySt', 'omdbKeySt', 'sortPctOpt', 'colorCustom', 'mlist', 'viewTog',
    'sortSel', 'sortDir', 'settSortSel', 'portableSettingsWrap', 'smbUrlModeTitle', 'smbUrlModeHint',
    'smbUrlModeToggle', 'ttabList', 'ttabGrid', 'playLabel'
  ]) nodes.set(id, node());
  const fields = {
    tmdbKeyInp: settings.tmdbKey, omdbKeyInp: settings.omdbKey, smbPathInp: settings.smbBase,
    localPathInp: Object.keys(settings.smbMap)[0], csfdMatcherUrlInp: settings.csfdMatcherUrl,
    portableMpcInp: settings.portableMpcPath, portableVlcInp: settings.portableVlcPath
  };
  for (const [id, value] of Object.entries(fields)) nodes.get(id).value = value;
  for (const [id, value] of Object.entries({
    autoPullTog: settings.autoPull, autoPushTog: settings.preferences.autoPush,
    showRecentTog: settings.preferences.showRecent, debugModeTog: settings.debugMode
  })) nodes.get(id).checked = value;
  for (const [id, attribute, values] of [
    ['ratingSrcToggle', 'src', ['csfd', 'tmdb', 'imdb']], ['playerProtoToggle', 'proto', ['mpc', 'vlc', 'portable']],
    ['androidPlayerToggle', 'aproto', ['vlc', 'mxplayer', 'other']], ['pathModeToggle', 'mode', ['local', 'smb']],
    ['smbUrlModeToggle', 'smbmode', ['proto', 'raw']], ['portableTypeToggle', 'ptype', ['off', 'mpc', 'vlc']]
  ]) groups.set('#' + id + ' .ttab', values.map(value => node({ [attribute]: value })));
  groups.set('.skin-chip', ['dark', 'forest', 'auto'].map(skin => node({ skin })));
  groups.set('.color-swatch', [node({ gold: settings.accent.gold }), node({ gold: '#d4a943' })]);
  const root = node();
  vi.stubGlobal('document', {
    documentElement: root, body: { appendChild: vi.fn() },
    getElementById: id => nodes.get(id) || null,
    querySelectorAll: selector => groups.get(selector) || [],
    querySelector: selector => selector === '#playMovieBtn .sett-btn-label' ? nodes.get('playLabel') : null,
    createElement: () => { const link = node(); links.push(link); return link; }
  });
  vi.stubGlobal('window', {});
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  Object.assign(S, ui, {
    PK: 'mdb_prefs', THEME_KEY: 'mdb_theme1', ACCENT_KEY: 'mdb_accent',
    APP_VERSION: 'test', prefs: settings.preferences, ratingSource: settings.ratingSource,
    RATING_LABELS: { csfd: 'ČSFD', tmdb: 'TMDb', imdb: 'IMDb' },
    VIEW_ICONS: { list: 'list', grid: 'grid', posterwall: 'posterwall' }, VIEW_TITLES: {},
    THEME_ACCENTS: { dark: { gold: '#d4a943', gold2: '#f0c060' }, forest: { gold: '#22aa33', gold2: '#55cc66' }, linen: { gold: '#886633', gold2: '#aa8844' } },
    _autoThemeMq: { matches: false }, tmdbKey: settings.tmdbKey, omdbKey: settings.omdbKey,
    ghToken: settings.githubToken, autoPull: settings.autoPull,
    playerProto: settings.playerProto, androidPlayer: settings.androidPlayer,
    pathMode: settings.pathMode, smbUrlMode: settings.smbUrlMode, smbBase: settings.smbBase,
    smbMap: settings.smbMap, smbSources: settings.smbSources,
    csfdMatcherUrl: settings.csfdMatcherUrl, debugMode: settings.debugMode,
    all: [{ id: 7, title: 'Original' }], liveCache: { 7: { pct: 80 } },
    favs: new Set([7]), wl: new Set([7]), watched: new Set([7]), watchedDates: { 7: '2026-01-01' },
    autoPushTimer: null, _autoPullTimer: null,
    hasNativeAppBridge: vi.fn().mockReturnValue(false), nativeAppRequest: vi.fn(),
    applyFilters: vi.fn(), renderSmbSources: vi.fn(), updatePathPreview: vi.fn(), updateDebugInfo: vi.fn(),
    getPlayModeLabel: vi.fn().mockReturnValue('VLC'),
    ghPull: vi.fn(), ghPush: vi.fn(), scheduleAutoPush: vi.fn(),
    saveAllData: vi.fn(), saveMovies: vi.fn(), saveLiveCache: vi.fn()
  });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function expectMoviesUnchanged() {
  for (const [key, value] of Object.entries(movieStorage)) expect(storage.getItem(key)).toBe(value);
  expect(S.all).toEqual([{ id: 7, title: 'Original' }]);
  expect(S.liveCache).toEqual({ 7: { pct: 80 } });
  for (const collection of [S.favs, S.wl, S.watched]) expect([...collection]).toEqual([7]);
  expect(S.watchedDates).toEqual({ 7: '2026-01-01' });
  for (const action of ['ghPull', 'ghPush', 'scheduleAutoPush', 'saveAllData', 'saveMovies', 'saveLiveCache']) {
    expect(S[action]).not.toHaveBeenCalled();
  }
}

describe('settings export/import integration', () => {
  it('captures all settings and unsaved fields without changing storage or showing the saved token', () => {
    S.prefs.retiredOption = { movies: [] };
    expect(S.collectSettings()).toEqual(settingsFixture());
    nodes.get('ghTokenInp').value = ' new-test-token ';
    nodes.get('omdbKeyInp').value = ' new-test-omdb ';
    nodes.get('autoPullTog').checked = true;
    nodes.get('csfdMatcherUrlInp').value = 'matcher.example/new';
    const settings = S.collectSettings();
    expect(settings.githubToken).toBe('new-test-token');
    expect(settings.omdbKey).toBe('new-test-omdb');
    expect(settings.autoPull).toBe(true);
    expect(settings.csfdMatcherUrl).toBe('https://matcher.example/new');
    expect(storage.writes).toEqual([]);
    expectMoviesUnchanged();
  });
  it('restores the theme accent input when a file has no custom accent', () => {
    S.applySettingsFromFile(settingsFixture({ accent: null }));
    expect(nodes.get('colorCustom').value).toBe('#22aa33');
    expectMoviesUnchanged();
  });

  it('preserves additional local-to-SMB mappings while including a changed primary path', () => {
    S.smbMap['X:\\Other\\'] = 'smb://nas/Other/';
    nodes.get('localPathInp').value = 'Y:\\New';
    nodes.get('smbPathInp').value = 'smb://nas/New';
    expect(S.collectSettings().smbMap).toEqual({
      'Y:\\New\\': 'smb://nas/New/', 'X:\\Other\\': 'smb://nas/Other/'
    });
    expect(S.smbMap['W:\\Movies\\']).toBe('smb://media/Filmy/');
  });

  it('requires confirmation before export and sends only settings to Android', async () => {
    S.hasNativeAppBridge.mockReturnValue(true);
    S.nativeAppRequest.mockResolvedValue({ ok: true });
    expect(await S.exportSettingsFile()).toBe(true);
    expect(globalThis.confirm).toHaveBeenCalledWith(expect.stringContaining('bez šifrovania'));
    const [action, payload] = S.nativeAppRequest.mock.calls[0];
    expect(action).toBe('saveSettings');
    expect(payload.filename).toMatch(/^filmy-nastavenia-\d{4}-\d{2}-\d{2}\.json$/);
    expect(parseSettingsFile(payload.content)).toEqual(settingsFixture());
    expect(storage.writes).toEqual([]);
    expectMoviesUnchanged();
  });
  it('allows only one outstanding settings operation while a native picker is open', async () => {
    S.hasNativeAppBridge.mockReturnValue(true);
    let finish;
    S.nativeAppRequest.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const exporting = S.exportSettingsFile();
    expect(nodes.get('settBtnSaveAll').disabled).toBe(true);
    expect(nodes.get('settBtnLoadSettings').disabled).toBe(true);
    expect(await S.exportSettingsFile()).toBe(false);
    expect(await S.chooseSettingsFile()).toBe(false);
    expect(await S.loadSettingsFile(new File([content(settingsFixture())], 'settings.json'))).toBe(false);
    expect(S.nativeAppRequest).toHaveBeenCalledOnce();
    finish({ ok: false, cancelled: true });
    expect(await exporting).toBe(false);
    expect(nodes.get('settBtnSaveAll').disabled).toBe(false);
    expect(storage.writes).toEqual([]);
  });

  it('does not export when the credential warning is declined', async () => {
    globalThis.confirm.mockReturnValue(false);
    expect(await S.exportSettingsFile()).toBe(false);
    expect(S.nativeAppRequest).not.toHaveBeenCalled();
    expect(links).toHaveLength(0);
    expect(storage.writes).toEqual([]);
  });

  it('imports appearance, layout, sources, API keys and runtime player settings without a reload or sync', () => {
    const settings = settingsFixture({
      preferences: { view: 'list', sort: 'title', sortDir: 'desc', showRecent: false, autoPush: true },
      ratingSource: 'imdb', androidPlayer: 'vlc', portableMode: 'mpc',
      tmdbKey: '', omdbKey: '', githubToken: '', autoPull: true, debugMode: false
    });
    S.autoPushTimer = setTimeout(() => S.ghPush(), 500);
    S._autoPullTimer = setTimeout(() => S.ghPull(), 500);
    expect(S.importSettingsText(content(settings))).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(S.prefs).toEqual(settings.preferences);
    expect(S.grid).toBe(false); expect(S.posterWall).toBe(false);
    expect(globalThis.document.documentElement.attributes.get('data-skin')).toBe('forest');
    expect(globalThis.document.documentElement.style.getPropertyValue('--gold')).toBe('#123abc');
    expect(JSON.parse(storage.getItem('mdb_accent'))).toEqual(settings.accent);
    expect(globalThis.window.portableMode).toBe('mpc');
    expect(globalThis.window.portableMpcPath).toBe(settings.portableMpcPath);
    expect(nodes.get('sortSel').value).toBe('title');
    expect(nodes.get('tmdbKeyInp').value).toBe('');
    expect(nodes.get('sortPctOpt').textContent).toBe('Podľa % IMDb');
    expect(groups.get('#ratingSrcToggle .ttab')[2].classes.has('on')).toBe(true);
    expect(nodes.get('ghTokenInp').value).toBe('');
    expect(S.autoPushTimer).toBeNull(); expect(S._autoPullTimer).toBeNull();
    expect(S.applyFilters).toHaveBeenCalledOnce();
    expectMoviesUnchanged();
  });

  it('validates before confirmation and leaves runtime and storage untouched on an invalid film backup', () => {
    const original = new Map(storage.values);
    expect(() => S.importSettingsText('{"movies":[]}')).toThrow('platné nastavenia');
    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(storage.values).toEqual(original);
    expectMoviesUnchanged();
  });

  it('does not change anything if the import confirmation is declined or storage fails', () => {
    const original = new Map(storage.values);
    globalThis.confirm.mockReturnValue(false);
    expect(S.importSettingsText(content(settingsFixture({ theme: 'dark' })))).toBe(false);
    expect(storage.values).toEqual(original);
    globalThis.confirm.mockReturnValue(true);
    vi.spyOn(storage, 'setItem').mockImplementationOnce(() => { throw new Error('Disk full'); });
    expect(() => S.importSettingsText(content(settingsFixture({ theme: 'dark' })))).toThrow('nepodarilo uložiť');
    expect(S.applyFilters).not.toHaveBeenCalled();
    expect(storage.values).toEqual(original);
    expectMoviesUnchanged();
  });

  it('loads a bounded UTF-8 web file and rejects oversized, corrupt or movie files', async () => {
    expect(await S.loadSettingsFile(new File([content(settingsFixture())], 'settings.json'))).toBe(true);
    const original = new Map(storage.values);
    for (const file of [
      new File([new Uint8Array(256 * 1024 + 1)], 'large.json'),
      new File([new Uint8Array([0xc3, 0x28])], 'corrupt.json'), new File(['{"movies":[]}'], 'movies.json')
    ]) {
      expect(await S.loadSettingsFile(file)).toBe(false);
      expect(storage.values).toEqual(original);
    }
    expectMoviesUnchanged();
  });

  it('handles native picker cancellations and errors without changing data', async () => {
    S.hasNativeAppBridge.mockReturnValue(true);
    S.nativeAppRequest.mockResolvedValue({ ok: false, cancelled: true });
    expect(await S.chooseSettingsFile()).toBe(false);
    expect(await S.exportSettingsFile()).toBe(false);
    expect(globalThis.confirm).toHaveBeenCalledTimes(1); // Only the export warning.
    expect(nodes.get('saveAllSt').textContent).toContain('zrušené');
    S.nativeAppRequest.mockRejectedValue(new Error('Systémový výber nie je dostupný.'));
    expect(await S.chooseSettingsFile()).toBe(false);
    expect(nodes.get('saveAllSt').className).toContain('err');
    expect(nodes.get('settBtnLoadSettings').disabled).toBe(false);
    expect(storage.writes).toEqual([]);
    expectMoviesUnchanged();
  });

  it('loads native content through the same validated and confirmed importer', async () => {
    S.hasNativeAppBridge.mockReturnValue(true);
    S.nativeAppRequest.mockResolvedValue({ ok: true, content: content(settingsFixture({ ratingSource: 'tmdb' })) });
    expect(await S.chooseSettingsFile()).toBe(true);
    expect(S.nativeAppRequest).toHaveBeenCalledWith('loadSettings');
    expect(S.ratingSource).toBe('tmdb');
    expectMoviesUnchanged();
  });

  it('uses a real web save handle and reports write failure or cancellation without success', async () => {
    const writable = { write: vi.fn().mockResolvedValue(), close: vi.fn().mockResolvedValue(), abort: vi.fn() };
    globalThis.window.showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable: async () => writable });
    expect(await S.exportSettingsFile()).toBe(true);
    expect(parseSettingsFile(writable.write.mock.calls[0][0])).toEqual(settingsFixture());
    expect(writable.close).toHaveBeenCalledOnce();
    writable.write.mockRejectedValue(new Error('Full disk'));
    expect(await S.exportSettingsFile()).toBe(false);
    expect(writable.abort).toHaveBeenCalledOnce();
    globalThis.window.showSaveFilePicker.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    expect(await S.exportSettingsFile()).toBe(false);
    expect(nodes.get('saveAllSt').textContent).toContain('zrušené');
    expect(storage.writes).toEqual([]);
    expectMoviesUnchanged();
  });

  it('downloads in other browsers and clears the temporary object URL', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:settings-test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    expect(await S.exportSettingsFile()).toBe(true);
    expect(links[0].href).toBe('blob:settings-test');
    expect(links[0].download).toMatch(/\.json$/);
    expect(links[0].click).toHaveBeenCalledOnce();
    expect(links[0].remove).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(30000);
    expect(revoke).toHaveBeenCalledWith('blob:settings-test');
    expect(storage.writes).toEqual([]);
  });

  it('does not silently fall back to unsupported web pickers in an older Android APK', async () => {
    globalThis.window.FilmyCopy = {};
    expect(await S.exportSettingsFile()).toBe(false);
    expect(await S.chooseSettingsFile()).toBe(false);
    expect(nodes.get('saveAllSt').textContent).toContain('nový APK');
    expect(nodes.get('settingsFileInp').click).not.toHaveBeenCalled();
    expect(links).toHaveLength(0);
  });
  it('reports an unsupported native WebView even when neither bridge was injected', async () => {
    globalThis.window.location = { hostname: 'appassets.androidplatform.net' };
    expect(await S.exportSettingsFile()).toBe(false);
    expect(await S.chooseSettingsFile()).toBe(false);
    expect(nodes.get('saveAllSt').textContent).toContain('Android System WebView');
    expect(nodes.get('settingsFileInp').click).not.toHaveBeenCalled();
  });

  it('wires the web load button and clears the selected file for repeated imports', async () => {
    S.initSettingsTransfer();
    await nodes.get('settBtnLoadSettings').listeners.get('click')();
    expect(nodes.get('settingsFileInp').click).toHaveBeenCalledOnce();
    const input = nodes.get('settingsFileInp');
    input.files = [new File([content(settingsFixture())], 'settings.json')];
    const load = vi.spyOn(S, 'loadSettingsFile').mockResolvedValue(true);
    input.value = 'settings.json'; input.listeners.get('change').call(input);
    expect(input.value).toBe('');
    expect(load).toHaveBeenCalledWith(input.files[0]);
  });

  it('retains an imported custom accent when the application initializes its theme again', () => {
    S.initTheme();
    expect(globalThis.document.documentElement.style.getPropertyValue('--gold')).toBe('#123abc');
    expect(JSON.parse(storage.getItem('mdb_accent'))).toEqual(settingsFixture().accent);
  });
});
