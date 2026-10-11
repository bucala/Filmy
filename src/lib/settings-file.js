import { RATING_SOURCES } from './preferences.js';

export const SETTINGS_FORMAT = 'filmy-settings';
export const SETTINGS_VERSION = 1;
export const MAX_SETTINGS_BYTES = 256 * 1024;

// This allowlist is the only storage scope an imported settings file can write.
// Movie records, collections, metadata, sync guards and ETags are never included.
export const SETTINGS_STORAGE_KEYS = Object.freeze({
  preferences: 'mdb_prefs', theme: 'mdb_theme1', accent: 'mdb_accent',
  ratingSource: 'mdb_ratingsrc', tmdbKey: 'tmdb_key', omdbKey: 'omdb_key',
  githubToken: 'mdb_gh_token', autoPull: 'mdb_auto_pull',
  playerProto: 'mdb_player_proto', androidPlayer: 'mdb_android_player',
  pathMode: 'mdb_path_mode', smbUrlMode: 'mdb_smb_url_mode',
  smbBase: 'mdb_smb_base', smbMap: 'mdb_smb_map', smbSources: 'mdb_smb_sources',
  portableMode: 'mdb_portable_mode', portableMpcPath: 'mdb_portable_mpc',
  portableVlcPath: 'mdb_portable_vlc', csfdMatcherUrl: 'mdb_csfd_matcher_url',
  debugMode: 'mdb_debug_mode'
});
const JSON_FIELDS = new Set(['preferences', 'accent', 'smbMap', 'smbSources']);
const BOOLEAN_FIELDS = new Set(['autoPull', 'debugMode']);
const PREF_KEYS = ['view', 'sort', 'sortDir', 'showRecent', 'autoPush'];

function invalid() { throw new Error('Súbor neobsahuje platné nastavenia aplikácie Filmy.'); }
function record(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
function text(value, max = 8192) {
  return typeof value === 'string' && value.length <= max && !/[\x00-\x1f]/.test(value);
}
function smb(value) {
  if (!text(value)) return false;
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'smb:' && !!url.hostname; }
  catch { return false; }
}
function httpUrl(value) {
  if (!text(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname; }
  catch { return false; }
}

export function validateSettings(settings) {
  if (!exactKeys(settings, Object.keys(SETTINGS_STORAGE_KEYS))) invalid();
  const p = settings.preferences;
  if (!exactKeys(p, PREF_KEYS) || !['list', 'grid', 'posterwall'].includes(p.view) ||
      !['num', 'title', 'year', 'pct', 'dur'].includes(p.sort) ||
      !['asc', 'desc'].includes(p.sortDir) || typeof p.showRecent !== 'boolean' ||
      typeof p.autoPush !== 'boolean') invalid();
  if (!['dark', 'slate', 'crimson', 'forest', 'linen', 'paper', 'auto', 'gold', 'teal', 'violet'].includes(settings.theme) ||
      !RATING_SOURCES.includes(settings.ratingSource)) invalid();
  if (settings.accent !== null && (!exactKeys(settings.accent, ['gold', 'gold2']) ||
      !/^#[0-9a-f]{6}$/i.test(settings.accent.gold) || !/^#[0-9a-f]{6}$/i.test(settings.accent.gold2))) invalid();
  for (const field of ['tmdbKey', 'omdbKey', 'githubToken', 'portableMpcPath', 'portableVlcPath']) {
    if (!text(settings[field])) invalid();
  }
  if (typeof settings.autoPull !== 'boolean' || typeof settings.debugMode !== 'boolean' ||
      !['mpc', 'vlc', 'native', 'portable', 'embedded'].includes(settings.playerProto) ||
      !['vlc', 'mxplayer', 'other'].includes(settings.androidPlayer) ||
      !['local', 'smb'].includes(settings.pathMode) || !['proto', 'raw'].includes(settings.smbUrlMode) ||
      !['off', 'mpc', 'vlc'].includes(settings.portableMode) ||
      !httpUrl(settings.csfdMatcherUrl) || !smb(settings.smbBase)) invalid();
  if (!record(settings.smbMap) || Object.keys(settings.smbMap).length > 128) invalid();
  for (const [path, destination] of Object.entries(settings.smbMap)) {
    if (!path || !text(path) || ['__proto__', 'constructor', 'prototype'].includes(path) || !smb(destination)) invalid();
  }
  if (!Array.isArray(settings.smbSources) || settings.smbSources.length > 128 ||
      settings.smbSources.some(source => !exactKeys(source, ['name', 'url']) ||
        !text(source.name, 256) || !source.url || !smb(source.url))) invalid();
  return JSON.parse(JSON.stringify(settings));
}

export function serializeSettingsFile(settings, appVersion, now = new Date()) {
  const content = JSON.stringify({
    format: SETTINGS_FORMAT, version: SETTINGS_VERSION,
    appVersion: String(appVersion || ''), exportedAt: now.toISOString(),
    settings: validateSettings(settings)
  }, null, 2);
  if (new TextEncoder().encode(content).length > MAX_SETTINGS_BYTES) {
    throw new Error('Súbor nastavení je príliš veľký (maximum 256 KiB).');
  }
  return content;
}

export function parseSettingsFile(content) {
  if (typeof content !== 'string') invalid();
  if (new TextEncoder().encode(content).length > MAX_SETTINGS_BYTES) {
    throw new Error('Súbor nastavení je príliš veľký (maximum 256 KiB).');
  }
  let file;
  try { file = JSON.parse(content.replace(/^\uFEFF/, '')); }
  catch { invalid(); }
  if (!exactKeys(file, ['format', 'version', 'appVersion', 'exportedAt', 'settings']) ||
      file.format !== SETTINGS_FORMAT || file.version !== SETTINGS_VERSION ||
      !text(file.appVersion, 100) || !text(file.exportedAt, 100)) invalid();
  return validateSettings(file.settings);
}

export function storeSettings(storage, settings) {
  const clean = validateSettings(settings);
  const entries = Object.entries(SETTINGS_STORAGE_KEYS).map(([field, key]) => {
    const value = clean[field];
    return [key, value === null ? null : JSON_FIELDS.has(field) ? JSON.stringify(value) :
      BOOLEAN_FIELDS.has(field) ? (value ? '1' : '0') : value];
  });
  const previous = entries.map(([key]) => [key, storage.getItem(key)]);
  const written = new Set();
  try {
    for (const [key, value] of entries) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      written.add(key);
    }
  } catch {
    // Best-effort rollback is scoped to settings even if storage is full.
    for (const key of written) {
      try { storage.removeItem(key); } catch { /* Storage may no longer be accessible. */ }
    }
    for (const [key, value] of previous) {
      if (!written.has(key) || value === null) continue;
      try { storage.setItem(key, value); } catch { /* Report failure, not success. */ }
    }
    throw new Error('Nastavenia sa nepodarilo uložiť. Skontroluj voľné miesto a prístup k úložisku.');
  }
  return clean;
}
