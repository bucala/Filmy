// Embedded MPC-HC/BE playback for the Filmy desktop app: reparents the
// player window into the Electron window via Win32 SetParent, using koffi
// (prebuilt FFI binaries, no compilation). The renderer owns the overlay UI
// and reports the target rect in device pixels relative to the window's
// client area; this module owns the player process and its window.
//
// Legal note: same as players-win.js — the user's own installed player is
// merely launched via CLI and its window reparented; no bundling, linking,
// or modification of the player.
const { spawn } = require('child_process');
const playersWin = require('./players-win');

const GWL_STYLE = -16;
const WS_POPUP = 0x80000000;
const WS_CHILD = 0x40000000;
const WS_CAPTION = 0x00C00000;
const WS_THICKFRAME = 0x00040000;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const SW_SHOW = 5;
const WM_CLOSE = 0x0010;

let koffi = null;
let user32 = null;
let kernel32 = null;
let WndEnumProc = null;
let loadError = null;
try {
  koffi = require('koffi');
  user32 = koffi.load('user32.dll');
  kernel32 = koffi.load('kernel32.dll');
  WndEnumProc = koffi.proto('bool __stdcall WndEnumProc(void *hwnd, intptr_t lParam)');
} catch (e) {
  // koffi unavailable (not installed / wrong arch) — play() reports it.
  loadError = String((e && e.message) || e);
}

let fns = null;
function api() {
  if (fns || !user32) return fns;
  fns = {
    EnumWindows: user32.func('bool __stdcall EnumWindows(void *cb, intptr_t lParam)'),
    GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)'),
    IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(void *hwnd)'),
    IsWindow: user32.func('bool __stdcall IsWindow(void *hwnd)'),
    GetParent: user32.func('void *__stdcall GetParent(void *hwnd)'),
    SetParent: user32.func('void *__stdcall SetParent(void *child, void *newParent)'),
    GetWindowLongPtr: user32.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int nIndex)'),
    SetWindowLongPtr: user32.func('intptr_t __stdcall SetWindowLongPtrW(void *hwnd, int nIndex, intptr_t newLong)'),
    SetWindowPos: user32.func('bool __stdcall SetWindowPos(void *hwnd, void *insertAfter, int x, int y, int cx, int cy, uint32_t flags)'),
    ShowWindow: user32.func('bool __stdcall ShowWindow(void *hwnd, int nCmdShow)'),
    PostMessage: user32.func('bool __stdcall PostMessageW(void *hwnd, uint32_t msg, void *wParam, void *lParam)')
  };
  return fns;
}

// Must be called immediately after the Win32 call being diagnosed — any
// other FFI call in between would reset the thread-local error code.
let getLastErrorFn = null;
function lastErr() {
  try {
    if (!getLastErrorFn) getLastErrorFn = kernel32.func('uint32_t __stdcall GetLastError()');
    return getLastErrorFn();
  } catch (e) { return -1; }
}

// Finds the visible top-level window belonging to the given process id.
function findWindowByPid(pid) {
  var f = api();
  var found = null;
  var cb = koffi.register(function (hwnd) {
    var out = [0];
    f.GetWindowThreadProcessId(hwnd, out);
    if (out[0] === pid && f.IsWindowVisible(hwnd)) { found = hwnd; return false; }
    return true;
  }, koffi.pointer(WndEnumProc));
  f.EnumWindows(cb, 0);
  koffi.unregister(cb);
  return found;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

let current = null; // { pid, hwnd, child }

// opts: { path, rect: {x,y,width,height} (device px, client coords),
//         parentHandle (HWND as number) }
// -> { ok, label?, exe?, error? }
async function play(opts) {
  if (!user32) {
    return {
      ok: false,
      error: 'Chýba koffi alebo sa nepodarilo načítať user32.dll' +
        (loadError ? (' (' + loadError + ')') : '') + ' — v desktop/ spusti: npm install.'
    };
  }
  var f = api();
  var parentHandle = opts && opts.parentHandle;
  var rect = (opts && opts.rect) || null;
  var filePath = String((opts && opts.path) || '');
  if (!parentHandle) return { ok: false, error: 'Chýba handle okna aplikácie.' };
  if (!filePath) return { ok: false, error: 'Prázdna cesta k súboru.' };

  stop(); // only one embedded instance at a time

  var detected = await playersWin.detectPlayers();
  var exe = detected.mpcHc || detected.mpcBe;
  var label = detected.mpcHc ? 'MPC-HC' : 'MPC-BE';
  if (!exe) {
    return { ok: false, error: 'MPC-HC/BE nie je nainštalovaný (nenájdený v registri ani v štandardných cestách).' };
  }

  var arg = filePath;
  if (filePath.indexOf('smb://') === 0) arg = playersWin.smbToUnc(filePath);

  var child;
  try {
    child = spawn(exe, [arg, '/new', '/play'], { stdio: 'ignore', windowsHide: false });
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  child.on('error', function () { /* handled via timeout below */ });
  var exitedEarly = false;
  child.once('exit', function () { exitedEarly = true; });

  // Wait for the player to create its top-level window (up to ~15 s).
  var hwnd = null;
  for (var i = 0; i < 60 && !hwnd && !exitedEarly; i++) {
    await sleep(250);
    hwnd = findWindowByPid(child.pid);
  }
  if (!hwnd) {
    if (exitedEarly) {
      console.error('[embed-win] child exited before showing a window (pid ' + child.pid + ') — MPC možno poslal film do inej už bežiacej instancie.');
      return { ok: false, error: 'MPC sa ukončil hneď po spustení — zrejme bežala iná jeho instancia. Zavri všetky okná MPC a skús znova.' };
    }
    try { child.kill(); } catch (e) { /* already gone */ }
    console.error('[embed-win] timed out waiting for a window from pid ' + child.pid);
    return { ok: false, error: 'Okno prehrávača sa neobjavilo (timeout).' };
  }

  try {
    // Make it a chromeless child of the app window: clear WS_POPUP and the
    // caption/thick frame, set WS_CHILD, then reparent and place it.
    var style = Number(f.GetWindowLongPtr(hwnd, GWL_STYLE));
    style = (style & ~WS_CAPTION & ~WS_THICKFRAME & ~WS_POPUP) | WS_CHILD;
    f.SetWindowLongPtr(hwnd, GWL_STYLE, style >>> 0);
    f.SetParent(hwnd, parentHandle);
    if (rect) {
      f.SetWindowPos(hwnd, null, rect.x, rect.y, rect.width, rect.height,
        SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
    }
    f.ShowWindow(hwnd, SW_SHOW);
  } catch (e) {
    try { child.kill(); } catch (e2) { /* already gone */ }
    return { ok: false, error: 'Vnorenie okna zlyhalo: ' + String((e && e.message) || e) };
  }

  current = { pid: child.pid, hwnd: hwnd, child: child };
  child.on('exit', function () {
    if (current && current.pid === child.pid) current = null;
  });
  return { ok: true, label: label, exe: exe };
}

// Repositions the embedded player (window resized / layout changed).
function move(rect) {
  if (!current || !user32 || !rect) return { ok: false };
  try {
    var f = api();
    if (f.IsWindow(current.hwnd)) {
      f.SetWindowPos(current.hwnd, null, rect.x, rect.y, rect.width, rect.height,
        SWP_NOZORDER | SWP_NOACTIVATE);
    }
  } catch (e) { /* best effort */ }
  return { ok: true };
}

// Closes the embedded player: graceful WM_CLOSE, force-kill as fallback.
function stop() {
  if (!current) return { ok: true };
  var c = current;
  current = null;
  try {
    if (user32 && api().IsWindow(c.hwnd)) {
      api().PostMessage(c.hwnd, WM_CLOSE, null, null);
      setTimeout(function () { try { c.child.kill(); } catch (e) { /* gone */ } }, 2500);
    } else {
      try { c.child.kill(); } catch (e) { /* gone */ }
    }
  } catch (e) {
    try { c.child.kill(); } catch (e2) { /* gone */ }
  }
  return { ok: true };
}

// -> true while the embedded player window still exists.
function status() {
  if (!current) return false;
  try {
    if (user32 && api().IsWindow(current.hwnd)) return true;
  } catch (e) { /* fall through */ }
  current = null;
  return false;
}

module.exports = { play: play, move: move, stop: stop, status: status };
