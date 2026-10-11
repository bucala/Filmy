import { S } from './state.js';
import { DEFAULT_PREFS } from './lib/preferences.js';
import { MAX_SETTINGS_BYTES, parseSettingsFile, serializeSettingsFile, storeSettings, validateSettings } from './lib/settings-file.js';

let busy = false;

function field(id, fallback, keepBlank = true) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const value = el.value.trim();
  return value || (keepBlank ? '' : fallback);
}
function checked(id, fallback) {
  const el = document.getElementById(id);
  return el && typeof el.checked === 'boolean' ? el.checked : fallback;
}
function storedJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
  catch { return fallback; }
}
function isAndroidApp() {
  return !!window.FilmyCopy || (window.location && window.location.hostname === 'appassets.androidplatform.net');
}
function status(text, error = false) {
  const el = document.getElementById('saveAllSt');
  if (el) { el.textContent = text; el.className = 'sett-key-st' + (error ? ' err' : ''); }
}
function setBusy(value) {
  busy = value;
  ['settBtnSaveAll', 'settBtnLoadSettings'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = value;
  });
}

S.collectSettings = function collectSettings() {
  const current = { ...DEFAULT_PREFS, ...S.prefs };
  const preferences = Object.fromEntries(Object.keys(DEFAULT_PREFS).map(key => [key, current[key]]));
  preferences.autoPush = checked('autoPushTog', preferences.autoPush);
  preferences.showRecent = checked('showRecentTog', preferences.showRecent);
  let smbBase = field('smbPathInp', S.smbBase);
  if (smbBase && !smbBase.endsWith('/')) smbBase += '/';
  const smbMap = { ...S.smbMap }, oldLocal = Object.keys(smbMap)[0] || '';
  let local = field('localPathInp', oldLocal);
  if (local && !/[\\/]$/.test(local)) local += '\\';
  if (local !== oldLocal || smbBase !== S.smbBase) {
    if (oldLocal) delete smbMap[oldLocal];
    if (local) smbMap[local] = smbBase;
  }
  let matcher = field('csfdMatcherUrlInp', S.csfdMatcherUrl, false);
  if (!/^https?:\/\//i.test(matcher)) matcher = 'https://' + matcher;
  return validateSettings({
    preferences, theme: localStorage.getItem(S.THEME_KEY) || 'dark',
    accent: storedJson(S.ACCENT_KEY, null), ratingSource: S.ratingSource,
    tmdbKey: field('tmdbKeyInp', S.tmdbKey), omdbKey: field('omdbKeyInp', S.omdbKey),
    // The GitHub field intentionally stays blank when a token is already saved.
    githubToken: field('ghTokenInp', S.ghToken, false),
    autoPull: checked('autoPullTog', S.autoPull),
    playerProto: S.playerProto, androidPlayer: S.androidPlayer,
    pathMode: S.pathMode, smbUrlMode: S.smbUrlMode, smbBase, smbMap,
    smbSources: S.smbSources,
    portableMode: localStorage.getItem('mdb_portable_mode') || 'off',
    portableMpcPath: field('portableMpcInp', localStorage.getItem('mdb_portable_mpc') || ''),
    portableVlcPath: field('portableVlcInp', localStorage.getItem('mdb_portable_vlc') || ''),
    csfdMatcherUrl: matcher, debugMode: checked('debugModeTog', S.debugMode)
  });
};

function refreshControls(settings) {
  const values = {
    tmdbKeyInp: settings.tmdbKey, omdbKeyInp: settings.omdbKey,
    smbPathInp: settings.smbBase, localPathInp: Object.keys(settings.smbMap)[0] || '',
    portableMpcInp: settings.portableMpcPath, portableVlcInp: settings.portableVlcPath,
    csfdMatcherUrlInp: settings.csfdMatcherUrl, settSortSel: settings.preferences.sort
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id); if (el) el.value = value;
  });
  const toggles = {
    autoPullTog: settings.autoPull, autoPushTog: settings.preferences.autoPush,
    showRecentTog: settings.preferences.showRecent, debugModeTog: settings.debugMode
  };
  Object.entries(toggles).forEach(([id, value]) => {
    const el = document.getElementById(id); if (el) el.checked = value;
  });
  [
    ['ratingSrcToggle', 'src', settings.ratingSource],
    ['playerProtoToggle', 'proto', settings.playerProto],
    ['androidPlayerToggle', 'aproto', settings.androidPlayer],
    ['pathModeToggle', 'mode', settings.pathMode],
    ['smbUrlModeToggle', 'smbmode', settings.smbUrlMode],
    ['portableTypeToggle', 'ptype', settings.portableMode]
  ].forEach(([id, attribute, value]) => {
    document.querySelectorAll('#' + id + ' .ttab').forEach(button => {
      button.classList.toggle('on', button.dataset[attribute] === value);
    });
  });
  ['ttabList', 'ttabGrid'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle('on', settings.preferences.view === (id === 'ttabGrid' ? 'grid' : 'list'));
  });
  const portable = document.getElementById('portableSettingsWrap');
  if (portable) portable.style.display = settings.playerProto === 'portable' ? 'block' : 'none';
  ['smbUrlModeTitle', 'smbUrlModeHint', 'smbUrlModeToggle'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = settings.pathMode === 'smb' ? '' : 'none';
  });
  const token = document.getElementById('ghTokenInp');
  if (token) { token.value = ''; token.placeholder = settings.githubToken ? 'Token je uložený' : 'Personal Access Token'; }
  ['ghTokenSt', 'tmdbKeySt', 'omdbKeySt'].forEach((id, index) => {
    const el = document.getElementById(id);
    const set = !![settings.githubToken, settings.tmdbKey, settings.omdbKey][index];
    if (el) { el.textContent = set ? 'Kľúč je uložený' : 'Kľúč nie je nastavený'; el.className = 'sett-key-st' + (set ? ' ok' : ''); }
  });
  const label = document.getElementById('sortPctOpt');
  if (label) label.textContent = 'Podľa % ' + S.RATING_LABELS[settings.ratingSource];
  const color = document.getElementById('colorCustom');
  const theme = settings.theme === 'auto' ? (S._autoThemeMq.matches ? 'dark' : 'linen') : settings.theme;
  const accent = settings.accent || S.THEME_ACCENTS[theme];
  if (color && accent) color.value = accent.gold;
  const play = document.querySelector('#playMovieBtn .sett-btn-label');
  if (play && S.getPlayModeLabel) play.textContent = 'Prehráť · ' + S.getPlayModeLabel();
  if (S.renderSmbSources) S.renderSmbSources();
  if (S.updatePathPreview) S.updatePathPreview();
  if (S.updateDebugInfo) S.updateDebugInfo();
}

S.applySettingsFromFile = function applySettingsFromFile(settings) {
  const clean = storeSettings(localStorage, settings);
  // Importing credentials/preferences is not a request to pull or push movies.
  if (S.autoPushTimer) clearTimeout(S.autoPushTimer);
  if (S._autoPullTimer) clearTimeout(S._autoPullTimer);
  S.autoPushTimer = null; S._autoPullTimer = null;
  S.prefs = clean.preferences;
  Object.assign(S, {
    ratingSource: clean.ratingSource, tmdbKey: clean.tmdbKey, omdbKey: clean.omdbKey,
    ghToken: clean.githubToken, autoPull: clean.autoPull,
    playerProto: clean.playerProto, androidPlayer: clean.androidPlayer,
    pathMode: clean.pathMode, smbUrlMode: clean.smbUrlMode,
    smbBase: clean.smbBase, smbMap: clean.smbMap, smbSources: clean.smbSources,
    csfdMatcherUrl: clean.csfdMatcherUrl, debugMode: clean.debugMode
  });
  // Classic portable-handler.js keeps these as window globals.
  window.portableMode = clean.portableMode;
  window.portableMpcPath = clean.portableMpcPath;
  window.portableVlcPath = clean.portableVlcPath;
  if (S.applyTheme) S.applyTheme(clean.theme);
  if (clean.accent && S.applyAccentColor) S.applyAccentColor(clean.accent.gold, clean.accent.gold2);
  if (S.loadPrefs) S.loadPrefs();
  refreshControls(clean);
  if (S.applyFilters) S.applyFilters();
  return clean;
};

async function saveFile(content, filename) {
  if (S.hasNativeAppBridge && S.hasNativeAppBridge()) {
    return S.nativeAppRequest('saveSettings', { content, filename });
  }
  if (isAndroidApp()) throw new Error('Ukladanie nastavení na Android vyžaduje nový APK a aktuálny Android System WebView.');
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'Nastavenia Filmy', accept: { 'application/json': ['.json'] } }]
    });
    const writable = await handle.createWritable();
    try { await writable.write(content); await writable.close(); }
    catch {
      try { await writable.abort(); } catch { /* Failed writes must not report success. */ }
      throw new Error('Súbor nastavení sa nepodarilo zapísať.');
    }
    return { ok: true };
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { ok: true, download: true };
}

S.exportSettingsFile = async function exportSettingsFile() {
  if (busy) return false;
  try {
    const content = serializeSettingsFile(S.collectSettings(), S.APP_VERSION);
    if (!confirm('Uložiť všetky nastavenia do súboru? Súbor môže obsahovať API kľúče, GitHub token a prístupové údaje SMB bez šifrovania. Chráň ho a nezdieľaj verejne. Filmové dáta sa neexportujú.')) return false;
    setBusy(true); status('Vyber súbor pre nastavenia…');
    const result = await saveFile(content, 'filmy-nastavenia-' + new Date().toISOString().slice(0, 10) + '.json');
    if (result.cancelled) { status('Uloženie nastavení zrušené.'); return false; }
    status(result.download ? 'Stiahnutie súboru nastavení spustené.' : 'Nastavenia uložené do súboru.');
    return true;
  } catch (error) {
    status(error.name === 'AbortError' ? 'Uloženie nastavení zrušené.' : error.message, error.name !== 'AbortError');
    return false;
  } finally { setBusy(false); }
};

S.importSettingsText = function importSettingsText(content) {
  const settings = parseSettingsFile(content);
  if (!confirm('Načítať nastavenia zo súboru a nahradiť aktuálne nastavenia vrátane kľúčov a prehrávania? Filmy, obľúbené, watchlist, videné a metadáta sa nezmenia. Synchronizácia sa nespustí.')) {
    status('Načítanie nastavení zrušené.'); return false;
  }
  S.applySettingsFromFile(settings);
  status('Nastavenia načítané. Filmové dáta zostali nezmenené.');
  return true;
};

S.loadSettingsFile = async function loadSettingsFile(file) {
  if (!file || busy) return false;
  setBusy(true);
  try {
    if (file.size > MAX_SETTINGS_BYTES) throw new Error('Súbor nastavení je príliš veľký (maximum 256 KiB).');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new Error('Súbor nastavení sa nepodarilo prečítať ako UTF-8.'); }
    return S.importSettingsText(text);
  } catch (error) { status(error.message, true); return false; }
  finally { setBusy(false); }
};

S.chooseSettingsFile = async function chooseSettingsFile() {
  if (busy) return false;
  if (S.hasNativeAppBridge && S.hasNativeAppBridge()) {
    setBusy(true); status('Vyber súbor nastavení…');
    try {
      const result = await S.nativeAppRequest('loadSettings');
      if (result.cancelled) { status('Načítanie nastavení zrušené.'); return false; }
      return S.importSettingsText(result.content);
    } catch (error) { status(error.message, true); return false; }
    finally { setBusy(false); }
  }
  if (isAndroidApp()) { status('Načítanie nastavení na Android vyžaduje nový APK a aktuálny Android System WebView.', true); return false; }
  document.getElementById('settingsFileInp').click();
  return true;
};

S.initSettingsTransfer = function initSettingsTransfer() {
  document.getElementById('settBtnSaveAll').addEventListener('click', S.exportSettingsFile);
  document.getElementById('settBtnLoadSettings').addEventListener('click', S.chooseSettingsFile);
  const input = document.getElementById('settingsFileInp');
  input.addEventListener('change', function () {
    const file = this.files && this.files[0]; this.value = '';
    S.loadSettingsFile(file);
  });
};
