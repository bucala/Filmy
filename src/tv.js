/* Android TV / D-pad support layer.
   Activated ONLY on TV (leanback flag from native, or TV user-agent), so the
   touch experience on phone/tablet is untouched. Provides:
   - spatial (arrow) navigation between focusable elements
   - text-field selection without an IME, explicit OK/click to edit
   - OK/Enter -> click on non-native focusable cards
   - focus trap + auto-focus when a modal/overlay opens, restore on close
   - remote keys forwarded from native: guide -> search, info -> detail,
     menu -> settings
   Focus visibility is handled purely in CSS via :focus-visible + .tv rules. */
import { S } from './state.js';
import { nearestInDirection } from './lib/nav.js';

/* ── Long-press state (Enter held 1.5 s → quick-action overlay) ── */
var _lpCard = null, _lpTimer = null, _lpFired = false;
function clearLp() {
  if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
  _lpCard = null; _lpFired = false;
}

var FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[data-id]';

/* Focus selects a text field without opening the IME. Only OK or a pointer
   click starts editing. Remember each field's own input mode and never unlock
   fields that were already read-only. */
var _inputStates = new WeakMap(), _editingInput = null, _inputEnterHeld = false;

function isTextField(el) {
  if (!el) return false;
  var tag = (el.tagName || '').toLowerCase();
  return tag === 'textarea' || (tag === 'input' && /^(text|search|password|email|number|tel|url)$/.test(el.type || 'text'));
}

function prepareInput(el) {
  if (!isTextField(el) || _inputStates.has(el) || el.readOnly) return;
  _inputStates.set(el, { inputMode: el.getAttribute('inputmode') });
  el.readOnly = true;
  el.setAttribute('inputmode', 'none');
  el.classList.add('tv-input-idle');
}

function prepareInputs(root) {
  if (!root || !root.querySelectorAll) return;
  prepareInput(root);
  root.querySelectorAll('input,textarea').forEach(prepareInput);
}

function endInputEdit(refocus) {
  var el = _editingInput;
  if (!el) return false;
  _editingInput = null;
  el.readOnly = true;
  el.setAttribute('inputmode', 'none');
  el.classList.add('tv-input-idle');
  if (refocus && document.contains(el) && isVisible(el)) {
    el.blur();
    focusEl(el);
  }
  return true;
}

function beginInputEdit(el) {
  prepareInput(el);
  var state = _inputStates.get(el);
  if (!state || el.disabled || _editingInput === el) return;
  endInputEdit(false);
  // Refocusing an editable field inside the user gesture lets Android WebView
  // open its keyboard even though the remote had already focused it read-only.
  el.blur();
  _editingInput = el;
  el.readOnly = false;
  if (state.inputMode === null) el.removeAttribute('inputmode');
  else el.setAttribute('inputmode', state.inputMode);
  el.classList.remove('tv-input-idle');
  focusEl(el);
}

function consumeEvent(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

function onInputFocus(e) {
  if (S._tvOn) prepareInput(e.target);
}

function onInputBlur(e) {
  if (e.target === _editingInput) endInputEdit(false);
  if (e.target === _lpCard) clearLp();
}

function onClick(e) {
  if (!S._tvOn) return;
  // Some WebViews also synthesize a click while OK is held on the new menu.
  if ((_lpFired || _inputEnterHeld) && e.detail === 0) { consumeEvent(e); return; }
  if (isTextField(e.target)) beginInputEdit(e.target);
}

function observeInputs() {
  if (typeof MutationObserver === 'undefined') return;
  var obs = new MutationObserver(function (muts) {
    if (!S._tvOn) return;
    muts.forEach(function (mut) {
      mut.addedNodes.forEach(prepareInputs);
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

/* ── TV detection ── */
function detectTv() {
  if (window.__ANDROID_TV__ === true) return true;
  var ua = navigator.userAgent || '';
  return /\b(Google TV|Android TV|SMART-TV|SmartTV|BRAVIA|AFT[A-Za-z]|CrKey|GoogleTV|Leanback|Web0S|Tizen)\b/i.test(ua);
}

/* ── Element helpers ── */
function isVisible(el) {
  if (el.disabled) return false;
  if (el.getClientRects().length === 0) return false;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function visibleFocusable(scope) {
  var out = [];
  var dock = document.getElementById('copyDock');
  var roots = (scope.id === 'mainSc' || scope.id === 'detSc') && dock ? [scope, dock] : [scope];
  var list = roots.flatMap(function (root) { return Array.from(root.querySelectorAll(FOCUSABLE)); });
  for (var i = 0; i < list.length; i++) {
    var el = list[i];
    // Treat each movie card as a single focus stop: skip focusable descendants
    // of a [data-id] card (inner play/fav buttons) — OK opens the detail.
    var card = el.closest('[data-id]');
    if (card && card !== el && !el.classList.contains('copy-select')) continue;
    if (!isVisible(el)) continue;
    out.push(el);
  }
  return out;
}

/* Topmost open overlay, else the main screen. */
function activeScope() {
  var copyOv = document.getElementById('copyOv');
  if (copyOv && !copyOv.classList.contains('hidden')) return copyOv;
  var tvAct = document.getElementById('tvActOv');
  if (tvAct && !tvAct.classList.contains('hidden')) return tvAct;
  var ovs = document.querySelectorAll('.m-ov:not(.hidden), .tr-ov:not(.hidden)');
  if (ovs.length) return ovs[ovs.length - 1];
  var sett = document.getElementById('settPanel');
  if (sett && !sett.classList.contains('hidden')) return sett;
  var fp = document.getElementById('fpPanel');
  if (fp && fp.classList.contains('open')) return fp;
  var admin = document.getElementById('adminPanelSc');
  if (admin && admin.offsetParent !== null) return admin;
  var det = document.getElementById('detSc');
  if (det && !det.classList.contains('hidden')) return det;
  var stat = document.getElementById('statSc');
  if (stat && !stat.classList.contains('hidden')) return stat;
  return document.getElementById('mainSc') || document.body;
}

function focusEl(el) {
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) {}
}

/* Segmented toggle rows (.sett-toggle) are a single unit for vertical nav —
   Up/Down should always land on the row's active member and never stop on a
   sibling tab, or a sibling could end up permanently unreachable depending on
   which member last had focus. Left/Right still moves between members. */
function groupOf(el) {
  return el.closest('.sett-toggle');
}

/* Pick the nearest focusable element in a direction from the current one. */
function pick(dir, cur, cands) {
  var vertical = (dir === 'up' || dir === 'down');
  var curGroup = groupOf(cur);
  var cr = (vertical && curGroup) ? curGroup.getBoundingClientRect() : cur.getBoundingClientRect();
  var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  var points = [];
  for (var i = 0; i < cands.length; i++) {
    var el = cands[i];
    if (el === cur) continue;
    var elGroup = groupOf(el);
    if (vertical && elGroup && elGroup === curGroup) continue; // same row — not a vertical target
    var r = (vertical && elGroup) ? elGroup.getBoundingClientRect() : el.getBoundingClientRect();
    points.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, el: el, group: elGroup });
  }
  var winner = nearestInDirection(dir, cx, cy, points);
  if (!winner) return null;
  var best = winner.el, bestGroup = winner.group;
  // Entering a toggle group vertically always lands on its active member.
  if (vertical && bestGroup) {
    var onBtn = bestGroup.querySelector('.ttab.on') || bestGroup.querySelector('.ttab');
    if (onBtn && cands.indexOf(onBtn) !== -1) best = onBtn;
  }
  return best;
}

function onKey(e) {
  if (!S._tvOn) return;
  if (e.isComposing || e.keyCode === 229) return;
  var t = e.target || document.activeElement;
  var tag = (t && t.tagName || '').toLowerCase();
  var editing = isTextField(t) && _editingInput === t;
  var key = e.key;

  if (key === 'Escape') {
    if (endInputEdit(true)) { consumeEvent(e); return; }
    var tvAct = document.getElementById('tvActOv');
    if (tvAct && !tvAct.classList.contains('hidden')) { consumeEvent(e); hideCardActions(); return; }
    clearLp();
    return;
  }

  // Enter on a card: short press → open detail; hold 1.5 s → quick-action menu.
  if (key === 'Enter') {
    // Keep the opening press latched until keyup, even after focus moves to a
    // menu button. Repeats must not activate the newly focused control.
    if (_lpFired || _inputEnterHeld || e.repeat) { consumeEvent(e); return; }
    if (isTextField(t) && !editing && _inputStates.has(t)) {
      consumeEvent(e);
      _inputEnterHeld = true;
      beginInputEdit(t);
      return;
    }
    if (t && t.hasAttribute && t.hasAttribute('data-id') &&
        !t.matches('button,a,input,select,textarea')) {
      consumeEvent(e);
      if (_lpCard !== t) { clearLp(); _lpCard = t; }
      if (!_lpTimer) {
        _lpTimer = setTimeout(function () {
          var card = _lpCard;
          _lpCard = null; _lpTimer = null;
          if (!card || document.activeElement !== card || !document.contains(card) || !isVisible(card)) return;
          _lpFired = true;
          showCardActions(card);
        }, 1500);
      }
      return;
    }
    // Non-native focusable stops (person links, similar-film cards, tag-add)
    // expose role="button" — activate them directly, browsers only do this
    // automatically for real <button>/<a href> elements.
    if (t && t.getAttribute && t.getAttribute('role') === 'button' &&
        !t.matches('button,a[href],input,select,textarea')) {
      consumeEvent(e);
      t.click();
    }
    return;
  }

  if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return;
  if (editing && (tag === 'textarea' || key === 'ArrowLeft' || key === 'ArrowRight')) return; // caret movement
  if (tag === 'input' && t.type === 'range' && (key === 'ArrowLeft' || key === 'ArrowRight')) return;
  // A closed select is a navigation stop; OK opens its native chooser.
  // Letting every arrow change the closed select would trap the remote there.
  if (_lpCard) clearLp();

  var dir = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right';
  var scope = activeScope();

  var cands = visibleFocusable(scope);
  if (!cands.length) return;

  var active = document.activeElement;
  // The nonmodal dock is outside the screen DOM, but belongs to its focus scope.
  var cur = cands.indexOf(active) !== -1 ? active : null;
  if (!cur) { e.preventDefault(); focusEl(cands[0]); return; }

  var next = pick(dir, cur, cands);
  if (next) { e.preventDefault(); focusEl(next); }
  else if (scope.id !== 'mainSc') { e.preventDefault(); } // trap inside modal
}

/* ── Focus trap: move focus into a modal when it opens, restore on close ── */
var _lastFocus = null;
var MODAL_IDS = ['settPanel', 'fpPanel', 'adminPanelSc', 'detSc', 'statSc',
  'trOv', 'mOv', 'matchOv', 'dupOv', 'mapOv', 'timelineOv', 'decadeOv', 'quickAddOv', 'shareOv'];
MODAL_IDS.push('copyOv');

function isOpen(el) {
  if (el.id === 'fpPanel') return el.classList.contains('open');
  if (el.id === 'adminPanelSc') return el.offsetParent !== null;
  return !el.classList.contains('hidden');
}

function observeModals() {
  if (typeof MutationObserver === 'undefined') return;
  var obs = new MutationObserver(function (muts) {
    if (!S._tvOn) return;
    for (var i = 0; i < muts.length; i++) {
      var el = muts[i].target;
      var open = isOpen(el);
      if (open && !el._tvOpen) {
        el._tvOpen = true;
        _lastFocus = document.activeElement;
        setTimeout(function (node) {
          var f = visibleFocusable(node)[0];
          if (f) focusEl(f);
        }.bind(null, el), 80);
      } else if (!open && el._tvOpen) {
        el._tvOpen = false;
        setTimeout(function () {
          if (_lastFocus && document.contains(_lastFocus) && isVisible(_lastFocus)) focusEl(_lastFocus);
        }, 40);
      }
    }
  });
  MODAL_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  });
}

/* First movie card on the main screen, else first focusable in scope.
   Avoids auto-focusing the search field (which would pop the on-screen IME). */
function initialTarget(scope) {
  if (scope.id === 'mainSc' || scope === document.body) {
    var ml = document.getElementById('mlist');
    if (ml) {
      var card = ml.querySelector('[data-id]');
      if (card && isVisible(card)) return card;
    }
  }
  return visibleFocusable(scope)[0] || null;
}

function applyTvMode() {
  if (S._tvOn) return;
  S._tvOn = true;
  document.documentElement.classList.add('tv');
  prepareInputs(document);
  setTimeout(function () {
    var f = initialTarget(activeScope());
    if (f) focusEl(f);
  }, 150);
}

/* Called by the native layer once it knows the device is a TV. */
window.__enableTvMode = function () { applyTvMode(); };

/* Back/OK from the TV remote: close the topmost open overlay and report
   whether anything was closed, so native only exits when nothing is open. */
window.__tvBack = function () {
  if (endInputEdit(true)) return true;
  var copyOv = document.getElementById('copyOv');
  if (copyOv && !copyOv.classList.contains('hidden')) { S.closeCopyPanel(); return true; }
  var tvAct = document.getElementById('tvActOv');
  if (tvAct && !tvAct.classList.contains('hidden')) { hideCardActions(); return true; }
  var ovs = document.querySelectorAll('.m-ov:not(.hidden), .tr-ov:not(.hidden)');
  if (ovs.length) {
    var top = ovs[ovs.length - 1];
    var closeBtn = top.querySelector('[id$="Close"], [id$="close"], .m-close');
    if (closeBtn) closeBtn.click(); else top.classList.add('hidden');
    return true;
  }
  var sett = document.getElementById('settPanel');
  if (sett && !sett.classList.contains('hidden')) { if (S.closeSett) S.closeSett(); return true; }
  var fp = document.getElementById('fpPanel');
  if (fp && fp.classList.contains('open')) { if (S.closeFp) S.closeFp(); return true; }
  var admin = document.getElementById('adminPanelSc');
  if (admin && admin.offsetParent !== null) { if (S.closeAdmin) S.closeAdmin(); return true; }
  var stat = document.getElementById('statSc');
  if (stat && !stat.classList.contains('hidden')) { if (S.closeStat) S.closeStat(); return true; }
  var det = document.getElementById('detSc');
  if (det && !det.classList.contains('hidden')) {
    var back = document.getElementById('btnBack');
    if (back) back.click();
    return true;
  }
  return false;
};

/* Remote keys forwarded from MainActivity (GUIDE/INFO/MENU). */
window.__tvKey = function (name) {
  if (!S._tvOn) applyTvMode();
  if (name === 'guide') {
    var inp = document.getElementById('srchInp');
    if (inp) { focusEl(inp); if (inp.select) inp.select(); }
  } else if (name === 'info') {
    var a = document.activeElement;
    if (a && a.hasAttribute && a.hasAttribute('data-id')) a.click();
    else if (S.curId != null && S.openDet) S.openDet(S.curId);
  } else if (name === 'menu') {
    if (S.openSett) S.openSett();
  }
};

/* ── Quick-action overlay (long-press on card) ── */
function showCardActions(card) {
  var id = parseInt(card.dataset.id, 10);
  var ov = document.getElementById('tvActOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'tvActOv';
    document.body.appendChild(ov);
  }
  var isFav = S.favs && S.favs.has(id);
  ov.className = 'tv-act-ov';
  ov.innerHTML =
    '<div class="tv-act-menu">' +
    '<button id="tvActPlay" class="tv-act-btn" aria-label="Prehráť">' +
      '<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true"><polygon points="6,3 20,12 6,21"/></svg>' +
      '<span>Prehráť</span>' +
    '</button>' +
    '<button id="tvActFav" class="tv-act-btn" aria-label="' + (isFav ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených') + '">' +
      (isFav ? S.STAR_ON : S.STAR_OFF) +
      '<span>' + (isFav ? 'Odstrániť' : 'Obľúbené') + '</span>' +
    '</button>' +
    '</div>';
  _lastFocus = card;
  document.getElementById('tvActPlay').onclick = function () {
    hideCardActions(); if (S.playMovie) S.playMovie(id);
  };
  document.getElementById('tvActFav').onclick = function () {
    if (S.togFav) S.togFav(id, null); hideCardActions();
  };
  ov.addEventListener('click', function (e) {
    if (e.target === ov) hideCardActions();
  }, { once: true });
  setTimeout(function () {
    if (!ov.classList.contains('hidden') && activeScope() === ov) focusEl(document.getElementById('tvActPlay'));
  }, 50);
}

function hideCardActions() {
  var ov = document.getElementById('tvActOv');
  if (!ov) return;
  ov.className = 'tv-act-ov hidden';
  if (_lastFocus && document.contains(_lastFocus) && isVisible(_lastFocus)) focusEl(_lastFocus);
}

/* Release Enter: short press → click card; long press already handled by timeout. */
function onKeyUp(e) {
  if (!S._tvOn) return;
  var key = e.key;
  if (key === 'Enter') {
    if (_inputEnterHeld) {
      consumeEvent(e);
      _inputEnterHeld = false;
      return;
    }
    var card = _lpCard;
    if (card || _lpFired) consumeEvent(e);
    clearLp();
    if (card && document.activeElement === card && document.contains(card) && isVisible(card)) card.click();
  }
}

S.initTv = function initTv() {
  document.addEventListener('keydown', onKey, true); // capture: run before app handlers
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('focusin', onInputFocus, true);
  document.addEventListener('focusout', onInputBlur, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('blur', function () {
    clearLp();
    _inputEnterHeld = false;
    endInputEdit(false);
  });
  observeInputs();
  observeModals();
  if (detectTv()) applyTvMode();
  else if (S._tvOn) prepareInputs(document);
};
