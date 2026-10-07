import { S } from './state.js';
import { esc } from './lib/text.js';
import { copyItem, copyBusy, createCopyMeter, formatBytes, formatCopyTime } from './lib/copy.js';
import { createWebCopier } from './lib/copy-web.js';

S.copyMode = false;
S.copySel = new Set();
let adapter = null, snapshot = { phase: 'idle' }, source = '', destination = '', picking = false;
let returnFocus = null, meter = createCopyMeter(), lastItemsKey = '', lastPhase = '';
const pending = new Map();

function nativeResult(result) {
  if (result && result.ok === false) {
    if (result.cancelled) return result;
    throw new Error(result.error || 'Kopírovanie sa nepodarilo.');
  }
  return result;
}

function createAndroidAdapter(bridge) {
  bridge.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'progress') { update(message.snapshot); return; }
      const request = pending.get(message.id);
      if (request) { pending.delete(message.id); clearTimeout(request.timer); request.resolve(message.result); }
    } catch {}
  };
  function request(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      // The system folder picker can remain open arbitrarily long.
      const timer = action === 'pick' ? null : setTimeout(() => {
        pending.delete(id); reject(new Error('Android neodpovedá. Otvor priebeh znovu.'));
      }, 15000);
      pending.set(id, { resolve, timer });
      try { bridge.postMessage(JSON.stringify({ id, action, ...payload })); }
      catch (e) { pending.delete(id); clearTimeout(timer); reject(e); }
    }).then(nativeResult);
  }
  return {
    kind: 'android',
    pick: role => request('pick', { role }),
    start: items => request('start', { items }),
    status: () => request('status'),
    cancel: () => request('cancel')
  };
}

function detectAdapter() {
  if (window.filmyNative && typeof window.filmyNative.copyStart === 'function') {
    const native = window.filmyNative;
    native.onCopyProgress(update);
    return {
      kind: 'desktop', pick: role => native.copyPickFolder(role).then(nativeResult),
      start: items => native.copyStart(items).then(nativeResult),
      status: () => native.copyStatus().then(nativeResult),
      cancel: () => native.copyCancel().then(nativeResult)
    };
  }
  if (window.FilmyCopy && typeof window.FilmyCopy.postMessage === 'function') return createAndroidAdapter(window.FilmyCopy);
  if (window.isSecureContext && typeof window.showDirectoryPicker === 'function') {
    const copier = createWebCopier();
    return { kind: 'web', pick: role => copier.pick(role), start: items => copier.start(items, update),
      status: () => Promise.resolve(copier.status()), cancel: () => copier.cancel() };
  }
  return null;
}

function selectionLabel(movie, selected) {
  return (selected ? 'Zrušiť výber: ' : 'Vybrať na kopírovanie: ') + (movie.title || '');
}

function selectionIcon(selected) {
  return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/>' +
    (selected ? '<path d="m7 12 3 3 7-7"/>' : '') + '</svg>';
}

S.copySelectionHTML = function copySelectionHTML(movie) {
  if (!S.copyMode) return '';
  const selected = S.copySel.has(movie.id);
  return `<button class="copy-select${selected ? ' selected' : ''}" type="button" aria-pressed="${selected}" aria-label="${esc(selectionLabel(movie, selected))}" title="Vybrať na kopírovanie">${selectionIcon(selected)}</button>`;
};

S.toggleCopyCard = function toggleCopyCard(card) {
  const id = Number(card.dataset.id);
  if (S.copySel.has(id)) S.copySel.delete(id); else S.copySel.add(id);
  card.classList.toggle('copy-sel', S.copySel.has(id));
  const button = card.querySelector('.copy-select');
  if (button) {
    const movie = S.all.find(movie => movie.id === id) || {};
    const selected = S.copySel.has(id);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', selectionLabel(movie, selected));
    button.innerHTML = selectionIcon(selected);
  }
  render();
};

S.toggleCopyMode = function toggleCopyMode(force) {
  const next = typeof force === 'boolean' ? force : !S.copyMode;
  if (next && S.bulkMode) S.toggleBulkMode();
  S.copyMode = next;
  if (!next) S.copySel.clear();
  document.getElementById('btnCopy').setAttribute('aria-pressed', String(next));
  document.getElementById('btnCopy').classList.toggle('on', next);
  S.applyFilters();
  render();
  if (next) S.toast('Filmy označ tlačidlom na karte. Kliknutím na kartu otvoríš detail.');
};

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}
function update(next) {
  if (!next || !next.phase) return;
  snapshot = next;
  if (next.source) source = next.source;
  if (next.destination) destination = next.destination;
  render();
}

function render() {
  const running = copyBusy(snapshot.phase);
  const metrics = meter(snapshot);
  const label = snapshot.phase === 'scanning' ? 'Hľadám súbory v zvolenom zdroji…' :
    snapshot.phase === 'cancelling' ? 'Zastavujem a odstraňujem nedokončený súbor…' :
    snapshot.phase === 'copying' ? 'Kopírujem' :
    snapshot.phase === 'cancelled' ? 'Kopírovanie zastavené' :
    snapshot.phase === 'done' ? (snapshot.failed ? 'Dokončené s chybami' : 'Kopírovanie dokončené') : 'Priprav kopírovanie';
  const dock = document.getElementById('copyDock');
  dock.classList.toggle('hidden', !S.copyMode && !running && snapshot.phase === 'idle');
  dock.classList.toggle('copy-running', running);
  setText('copyDockTitle', running ? label : S.copySel.size + ' vybraných filmov');
  setText('copyDockText', running ?
    formatBytes(metrics.bytes) + ' / ' + formatBytes(metrics.total) + ' · ' + (metrics.rate ? formatBytes(metrics.rate) + '/s' : 'Meriam…') :
    snapshot.phase === 'idle' ? 'Karty môžeš ďalej prezerať.' : label);
  document.getElementById('copyDockFill').style.width = metrics.percent + '%';
  // Browsing needs only the dock. Build the large queue when its panel is open.
  if (document.getElementById('copyOv').classList.contains('hidden')) return;
  setText('copySelected', S.copySel.size + ' vybraných filmov');
  setText('copySourceName', source || 'Žiadny priečinok');
  setText('copyDestinationName', destination || 'Žiadny priečinok');
  if (snapshot.phase !== lastPhase) { lastPhase = snapshot.phase; setText('copyPhase', label); }
  setText('copyCurrent', snapshot.current || snapshot.target || 'Súbory sa neprenesú, kým nestlačíš Kopírovať.');
  setText('copyBytes', formatBytes(metrics.bytes) + ' / ' + formatBytes(metrics.total));
  setText('copySpeed', metrics.rate && running ? formatBytes(metrics.rate) + '/s' : '–');
  setText('copyEta', snapshot.phase === 'copying' ? formatCopyTime(metrics.eta == null ? NaN : metrics.eta) : '–');
  setText('copyElapsed', snapshot.jobId ? formatCopyTime(metrics.elapsed) : '–');
  setText('copySummary', snapshot.jobId ?
    `${snapshot.copied || 0} skopírovaných · ${snapshot.skipped || 0} preskočených · ${snapshot.failed || 0} chýb` : '');
  const progress = document.getElementById('copyProgress');
  const value = metrics.percent;
  progress.value = value;
  progress.setAttribute('aria-valuetext', value.toFixed(1) + ' % prenesených dát');
  document.getElementById('copyPanel').classList.toggle('copy-running', running);
  ['copyPickSource', 'copyPickDestination'].forEach(id => {
    document.getElementById(id).disabled = !adapter || running || picking;
  });
  document.getElementById('copyStart').disabled = !adapter || running || picking || !source || !destination || !S.copySel.size;
  document.getElementById('copyCancel').classList.toggle('hidden', !running);
  document.getElementById('copyCancel').disabled = snapshot.phase === 'cancelling';
  const items = snapshot.items || [];
  const key = JSON.stringify(items.map(item => [item.id, item.state, item.error]));
  if (key !== lastItemsKey) {
    lastItemsKey = key;
    const states = { pending: 'Čaká', ready: 'Pripravený', copying: 'Kopírujem', copied: 'Skopírovaný',
      error: 'Chyba', skipped: 'Preskočený', cancelled: 'Zastavený' };
    document.getElementById('copyQueue').innerHTML = items.map(item =>
      `<li class="copy-item ${item.state}"><span class="copy-item-title">${esc(item.title || item.name)}</span><span class="copy-item-state">${esc(states[item.state] || 'Čaká')}</span><small>${esc(item.error || item.name || '')}</small></li>`).join('');
  }
  if (snapshot.error) setText('copyError', snapshot.error);
}

S.openCopyPanel = async function openCopyPanel() {
  returnFocus = document.activeElement;
  document.getElementById('copyOv').classList.remove('hidden');
  render();
  document.getElementById('copyClose').focus();
  if (adapter) try { update(await adapter.status()); } catch (e) { setText('copyError', e.message); }
};
S.closeCopyPanel = function closeCopyPanel() {
  document.getElementById('copyOv').classList.add('hidden');
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
};

async function pick(role) {
  if (!adapter || picking || copyBusy(snapshot.phase)) return;
  picking = true; render(); setText('copyError', '');
  try {
    const result = await adapter.pick(role);
    if (result && result.ok !== false) {
      if (role === 'source') source = result.name; else destination = result.name;
    }
  } catch (e) { if (e.name !== 'AbortError') setText('copyError', e.message); }
  finally { picking = false; render(); }
}

async function start() {
  if (!adapter || copyBusy(snapshot.phase) || !S.copySel.size) return;
  setText('copyError', '');
  const items = S.all.filter(movie => S.copySel.has(movie.id)).map(copyItem);
  snapshot = { phase: 'scanning' }; lastItemsKey = ''; render();
  try {
    // Native engines return immediately and send progress independently.
    // The web engine resolves only after the streams are closed.
    update(await adapter.start(items));
  } catch (e) { snapshot = { phase: 'idle' }; setText('copyError', e.message); render(); }
}

document.addEventListener('DOMContentLoaded', () => {
  adapter = detectAdapter();
  if (adapter && adapter.kind !== 'web') adapter.status().then(update).catch(e => setText('copyError', e.message));
  setText('copySupport', !adapter ?
    'Tento prehliadač nemá priamy zápis do priečinka. Na PC použi aktuálny Chrome/Edge cez HTTPS (aj PWA), na Androide natívnu appku s aktuálnym System WebView. Na TV musí byť dostupný systémový výber priečinkov.' :
    adapter.kind === 'web' ? 'Priamy prenos v tomto prehliadači. Nezatváraj ani neobnovuj kartu počas kopírovania.' :
    adapter.kind === 'android' ? 'Systémové priečinky zariadenia. Prenos prebieha len s otvorenou appkou, odchod do pozadia ho zastaví.' :
    'Natívny prenos zo zvoleného disku alebo priečinka. Appku nechaj spustenú.');
  document.getElementById('btnCopy').addEventListener('click', () => S.toggleCopyMode());
  document.getElementById('copyDockOpen').addEventListener('click', S.openCopyPanel);
  document.getElementById('copyDockExit').addEventListener('click', () => {
    S.toggleCopyMode(false);
    if (!copyBusy(snapshot.phase)) { snapshot = { phase: 'idle' }; render(); }
  });
  document.getElementById('copyClose').addEventListener('click', S.closeCopyPanel);
  document.getElementById('copyOv').addEventListener('click', e => { if (e.target.id === 'copyOv') S.closeCopyPanel(); });
  document.getElementById('copyPickSource').addEventListener('click', () => pick('source'));
  document.getElementById('copyPickDestination').addEventListener('click', () => pick('destination'));
  document.getElementById('copyStart').addEventListener('click', start);
  document.getElementById('copyCancel').addEventListener('click', async () => {
    if (!adapter) return;
    try { const result = await adapter.cancel(); if (result) update(result); } catch (e) { setText('copyError', e.message); }
  });
  document.getElementById('copySelectVisible').addEventListener('click', () => {
    document.querySelectorAll('#mlist [data-id]').forEach(card => S.copySel.add(Number(card.dataset.id)));
    S.applyFilters(); render();
  });
  document.getElementById('copyClearSelection').addEventListener('click', () => {
    S.copySel.clear(); S.applyFilters(); render();
  });
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('copyOv');
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); S.closeCopyPanel(); }
    if (e.key === 'Tab') {
      const buttons = Array.from(overlay.querySelectorAll('button:not([disabled])')).filter(button => button.offsetParent !== null);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  // Keep ETA honest when I/O stalls instead of leaving an old speed displayed.
  setInterval(async () => {
    if (!copyBusy(snapshot.phase)) return;
    if (adapter && adapter.kind !== 'web') {
      try { update(await adapter.status()); } catch {}
    } else render();
  }, 1000);
  window.addEventListener('beforeunload', event => {
    if (adapter && adapter.kind === 'web' && copyBusy(snapshot.phase)) {
      event.preventDefault(); event.returnValue = '';
    }
  });
  render();
});
