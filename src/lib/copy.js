import { buildMovieFilename, normalizeSlashes } from './text.js';

export const COPY_LIMIT = 2000;
export const VIDEO_FILE = /\.(?:mkv|mp4|avi|m4v|mov|wmv|ts|webm|mpg|mpeg|m2ts|vob|iso)$/i;

export function validCopyName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 240 &&
    !/[\\/:*?"<>|\u0000-\u001f]/.test(name) && !/[. ]$/.test(name) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) && VIDEO_FILE.test(name);
}

export function copyItem(movie) {
  const path = normalizeSlashes(String(movie._localPath || buildMovieFilename(movie)));
  const parts = path.split('/').filter(Boolean);
  if (/^[a-z]:$/i.test(parts[0] || '')) parts.shift();
  const name = parts[parts.length - 1] || '';
  if (!validCopyName(name) || parts.some(p => p === '.' || p === '..' || /[:\u0000-\u001f]/.test(p))) {
    return { id: String(movie.id), title: String(movie.title || ''), name, candidates: [], invalid: true };
  }
  // Most specific suffix first: choosing Movies/, its parent, or a relocated
  // library all works without ever reaching outside the selected source tree.
  const candidates = parts.map((_, i) => parts.slice(i).join('/'));
  return { id: String(movie.id), title: String(movie.title || ''), name, candidates };
}

export function copyFolderName(date = new Date(), suffix = crypto.randomUUID().slice(0, 8)) {
  return 'Filmy-' + date.toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-') + '-' + suffix;
}

export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const unit = Math.min(units.length - 1, Math.floor(Math.log(Math.max(1, n)) / Math.log(1024)));
  return (n / 1024 ** unit).toLocaleString('sk', { maximumFractionDigits: unit ? 1 : 0 }) + ' ' + units[unit];
}

export function formatCopyTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Meriam…';
  const n = Math.ceil(seconds);
  return (n >= 3600 ? Math.floor(n / 3600) + ':' : '') +
    String(Math.floor(n / 60) % 60).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

export function createCopyMeter() {
  let samples = [], jobId = null, started = 0;
  return function measure(snapshot, now = performance.now()) {
    const bytes = Math.max(0, Number(snapshot.transferredBytes) || 0);
    if (snapshot.jobId !== jobId || (samples.length && bytes < samples[samples.length - 1].bytes)) {
      jobId = snapshot.jobId;
      started = now - Math.max(0, Number(snapshot.elapsedMs) || 0);
      samples = [];
    }
    if (!samples.length || now > samples[samples.length - 1].now) samples.push({ now, bytes });
    while (samples.length > 2 && samples[1].now < now - 4000) samples.shift();
    const first = samples[0];
    const dt = (now - first.now) / 1000;
    const rate = dt >= 0.5 ? Math.max(0, (bytes - first.bytes) / dt) : 0;
    const total = Math.max(0, Number(snapshot.totalBytes) || 0);
    const running = snapshot.phase === 'copying';
    return {
      bytes, total, rate,
      percent: total ? Math.min(100, bytes / total * 100) : snapshot.phase === 'done' && snapshot.copied > 0 ? 100 : 0,
      eta: running && rate > 0 ? Math.max(0, total - bytes) / rate : null,
      elapsed: copyBusy(snapshot.phase) ? Math.max(0, (now - started) / 1000) : Math.max(0, Number(snapshot.elapsedMs) || 0) / 1000
    };
  };
}

export function copyBusy(phase) {
  return phase === 'scanning' || phase === 'copying' || phase === 'cancelling';
}
