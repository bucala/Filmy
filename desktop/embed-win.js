// Embedded MPC-HC/BE playback for the Filmy desktop app: reparents the
// player window into the Electron window via Win32 SetParent, using koffi
// (prebuilt FFI binaries, no compilation). The renderer owns the overlay UI
// and reports the target rect in device pixels relative to the window's
// client area; this module owns the player process and its window.
//
// Legal note: same as players-win.js — the user's own installed player is
// merely launched via CLI and its window reparented; no bundling, linking,
// or modification of the player.
const { spawn, execFile } = require('child_process');
const playersWin = require('./players-win');

// MPC-HC stores its DirectShow video renderer choice as a DWORD here; the
// enum values are confirmed straight from MPC-HC's own source
// (AppSettings.h: VIDRNDT_DS_*). The custom-presenter renderers (EVR Custom
// Presenter, madVR, Sync, MPC Video Renderer) each own an independent
// D3D11/DXGI swap chain tied to the window that existed when they
// initialized — reparenting that window elsewhere leaves the swap chain
// presenting into a surface nobody composites, which is exactly the
// "audio plays, video stays black" symptom seen while embedded. Plain EVR
// is a conventional DXVA-friendly windowed renderer that doesn't have this
// problem. The switch only touches the registry when the *current* choice
// is one of the fragile ones, and only for MPC-HC (MPC-BE's renderer enum
// hasn't been verified against its own source, so it's left untouched).
const MPC_HC_REG_KEY = 'HKCU\\Software\\MPC-HC\\MPC-HC\\Settings';
const MPC_HC_REG_VALUE = 'DSVidRen';
const VIDRNDT_DS_EVR = 10;
const MPC_HC_FRAGILE_RENDERERS = [11, 12, 13, 14]; // EVR-CP, madVR, Sync, MPCVR

// Reads a REG_DWORD via the built-in reg.exe (no new FFI surface for this;
// -> number, or null if the value/key doesn't exist or reg.exe failed).
function regQueryDword(key, name) {
  return new Promise(function (resolve) {
    execFile('reg', ['query', key, '/v', name], { windowsHide: true, timeout: 4000 }, function (err, stdout) {
      if (err) return resolve(null);
      var m = /REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(String(stdout));
      resolve(m ? parseInt(m[1], 16) : null);
    });
  });
}

function regSetDword(key, name, value) {
  return new Promise(function (resolve) {
    execFile('reg', ['add', key, '/v', name, '/t', 'REG_DWORD', '/d', String(value), '/f'],
      { windowsHide: true, timeout: 4000 }, function (err) {
        resolve(!err);
      });
  });
}

// Best-effort: switches MPC-HC to EVR before spawning it if (and only if)
// its currently-configured renderer is one of the fragile ones.
// -> { switched, savedValue } to remember for restoreRenderer().
async function maybeSwitchRenderer(label) {
  if (label !== 'MPC-HC') return { switched: false };
  try {
    var currentRenderer = await regQueryDword(MPC_HC_REG_KEY, MPC_HC_REG_VALUE);
    if (currentRenderer === null || MPC_HC_FRAGILE_RENDERERS.indexOf(currentRenderer) === -1) {
      return { switched: false };
    }
    var ok = await regSetDword(MPC_HC_REG_KEY, MPC_HC_REG_VALUE, VIDRNDT_DS_EVR);
    if (!ok) return { switched: false };
    console.log('[embed-win] switched MPC-HC renderer ' + currentRenderer + ' -> EVR (10) for embedded playback');
    return { switched: true, savedValue: currentRenderer };
  } catch (e) {
    console.error('[embed-win] renderer switch check failed (non-fatal):', e);
    return { switched: false };
  }
}

// Restores whatever renderer MPC-HC had configured before maybeSwitchRenderer
// changed it. Fire-and-forget from stop() — this is cleanup best-effort, not
// something worth delaying app shutdown for.
function restoreRenderer(saved) {
  if (!saved || !saved.switched) return;
  regSetDword(MPC_HC_REG_KEY, MPC_HC_REG_VALUE, saved.savedValue).then(function (ok) {
    console.log('[embed-win] restored MPC-HC renderer to ' + saved.savedValue + (ok ? '' : ' (failed)'));
  });
}

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
const RDW_INVALIDATE = 0x0001;
const RDW_ERASE = 0x0004;
const RDW_ALLCHILDREN = 0x0080;
const RDW_UPDATENOW = 0x0100;
const RDW_REPAINT_ALL = RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW;

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
    PostMessage: user32.func('bool __stdcall PostMessageW(void *hwnd, uint32_t msg, void *wParam, void *lParam)'),
    GetCurrentThreadId: kernel32.func('uint32_t __stdcall GetCurrentThreadId()'),
    AttachThreadInput: user32.func('bool __stdcall AttachThreadInput(uint32_t idAttach, uint32_t idAttachTo, bool fAttach)'),
    SetActiveWindow: user32.func('void *__stdcall SetActiveWindow(void *hwnd)'),
    SetFocus: user32.func('void *__stdcall SetFocus(void *hwnd)'),
    BringWindowToTop: user32.func('bool __stdcall BringWindowToTop(void *hwnd)'),
    RedrawWindow: user32.func('bool __stdcall RedrawWindow(void *hwnd, void *rcUpdate, void *hrgnUpdate, uint32_t flags)')
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

  var rendererSave = await maybeSwitchRenderer(label);

  var child;
  try {
    child = spawn(exe, [arg, '/new', '/play'], { stdio: 'ignore', windowsHide: false });
  } catch (e) {
    restoreRenderer(rendererSave);
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
    restoreRenderer(rendererSave);
    if (exitedEarly) {
      console.error('[embed-win] child exited before showing a window (pid ' + child.pid + ') — MPC možno poslal film do inej už bežiacej instancie.');
      return { ok: false, error: 'MPC sa ukončil hneď po spustení — zrejme bežala iná jeho instancia. Zavri všetky okná MPC a skús znova.' };
    }
    try { child.kill(); } catch (e) { /* already gone */ }
    console.error('[embed-win] timed out waiting for a window from pid ' + child.pid);
    return { ok: false, error: 'Okno prehrávača sa neobjavilo (timeout).' };
  }

  try {
    // Per SetParent's own MSDN remarks: when adopting a former top-level
    // ("child of the desktop") window, WS_POPUP must be cleared and
    // WS_CHILD set BEFORE calling SetParent — doing it after only assigns
    // an *owner*, not a true parent. GetParent() is documented to reliably
    // report the true parent only for WS_CHILD windows (it falls back to
    // reporting the *owner* for WS_POPUP windows, and simply fails/returns
    // NULL for a plain WS_OVERLAPPEDWINDOW like MPC's, regardless of what
    // SetParent already did) — so verifying via GetParent only makes sense
    // once WS_CHILD is actually set.
    var style = Number(f.GetWindowLongPtr(hwnd, GWL_STYLE));
    style = (style & ~WS_CAPTION & ~WS_THICKFRAME & ~WS_POPUP) | WS_CHILD;
    f.SetWindowLongPtr(hwnd, GWL_STYLE, style >>> 0);

    f.SetParent(hwnd, parentHandle);
    var setParentErrCode = lastErr();
    var actualParent = f.GetParent(hwnd);
    var reparented = actualParent !== null && actualParent !== undefined && Number(actualParent) === Number(parentHandle);
    if (!reparented) {
      console.error('[embed-win] GetParent mismatch after SetParent+WS_CHILD. actualParent=', actualParent,
        'expected=', parentHandle, 'GetLastError after SetParent=', setParentErrCode);
      try { child.kill(); } catch (e2) { /* already gone */ }
      restoreRenderer(rendererSave);
      return {
        ok: false,
        error: 'Vnorenie okna zlyhalo (GetParent nesúhlasí, Win32 chyba ' + setParentErrCode + '). Skontroluj, či appka aj MPC bežia v rovnakom režime (žiadny z nich ako správca).'
      };
    }

    if (rect) {
      f.SetWindowPos(hwnd, null, rect.x, rect.y, rect.width, rect.height,
        SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
    }
    f.ShowWindow(hwnd, SW_SHOW);

    // A reparented window that never gets real activation/focus stays in a
    // "background" state that many players treat as not actually visible:
    // hardware video renderers skip presenting frames (audio keeps playing
    // since that pipeline is separate) and the toolbar/OSD never runs its
    // first layout+paint. SetFocus/SetActiveWindow are no-ops across a
    // process boundary unless the calling thread's input is attached to the
    // target thread's — hence AttachThreadInput.
    //
    // Deliberately stays attached for the life of the embedded session
    // (detached only in stop()): MSDN notes that detaching restores each
    // thread's *pre-attach* input state, which would immediately undo the
    // SetFocus/SetActiveWindow below and leave MPC unable to receive
    // keyboard input again.
    var mpcTid = 0;
    try {
      var pidOut = [0];
      mpcTid = f.GetWindowThreadProcessId(hwnd, pidOut);
      var myTid = f.GetCurrentThreadId();
      var attached = f.AttachThreadInput(myTid, mpcTid, true);
      f.SetActiveWindow(hwnd);
      f.SetFocus(hwnd);
      f.BringWindowToTop(hwnd);
      f.RedrawWindow(hwnd, null, null, RDW_REPAINT_ALL);
      console.log('[embed-win] activation: mpcTid=' + mpcTid + ' myTid=' + myTid + ' attached=' + attached);
    } catch (e) {
      console.error('[embed-win] activation step failed (non-fatal):', e);
    }

    // MPC re-applies its own saved window placement shortly after showing,
    // which can undo the styling/position/focus above — reassert a couple
    // of times as things settle (codec/network load, renderer init).
    [350, 1200].forEach(function (delay) {
      setTimeout(function () {
        try {
          if (!f.IsWindow(hwnd)) return;
          if (rect) {
            f.SetWindowPos(hwnd, null, rect.x, rect.y, rect.width, rect.height,
              SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW);
          }
          f.RedrawWindow(hwnd, null, null, RDW_REPAINT_ALL);
        } catch (e) { /* best effort */ }
      }, delay);
    });
  } catch (e) {
    console.error('[embed-win] reparent threw', e);
    try { child.kill(); } catch (e2) { /* already gone */ }
    restoreRenderer(rendererSave);
    return { ok: false, error: 'Vnorenie okna zlyhalo: ' + String((e && e.message) || e) };
  }

  current = { pid: child.pid, hwnd: hwnd, child: child, mpcTid: mpcTid, rendererSave: rendererSave };
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
    if (user32 && c.mpcTid) {
      var f = api();
      f.AttachThreadInput(f.GetCurrentThreadId(), c.mpcTid, false);
    }
  } catch (e) { /* best effort — thread may already be gone */ }
  restoreRenderer(c.rendererSave);
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
