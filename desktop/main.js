const { app, BrowserWindow, Menu, Tray, shell, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const playersWin = require('./players-win');
const embedWin = require('./embed-win');

const PROD_URL = 'https://filmy-iota.vercel.app';
const LOCAL_SCHEME = 'app';
const LOCAL_URL = LOCAL_SCHEME + '://local/index.html';

// Packaged builds contain the web app under <app>/web (see package.json
// "files"); in dev (`electron .` from desktop/) it lives in the repo root.
const PKG_WEB_ROOT = path.join(__dirname, 'web');
const WEB_ROOT = fs.existsSync(PKG_WEB_ROOT) ? PKG_WEB_ROOT : path.join(__dirname, '..');

let mainWindow = null;
let tray = null;
let usingLocal = false;

// The app:// scheme must be privileged (secure + standard) before the app is
// ready so the ES-module web app, localStorage and fetch work exactly like
// on https — the file:// fallback could never support type="module".
protocol.registerSchemesAsPrivileged([
  { scheme: LOCAL_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

/* ── Single instance ── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(init);
}

function init() {
  registerLocalProtocol();
  registerIpc();
  createWindow();
  createTray();
  registerJumpList();
  Menu.setApplicationMenu(buildMenu());
}

/* ── Local offline bundle served over app:// ── */
function registerLocalProtocol() {
  protocol.handle(LOCAL_SCHEME, function (request) {
    var url = new URL(request.url);
    var rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    var filePath = path.normalize(path.join(WEB_ROOT, rel));
    if (filePath !== WEB_ROOT && filePath.indexOf(WEB_ROOT + path.sep) !== 0) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

/* ── IPC: native player bridge ── */
function registerIpc() {
  ipcMain.handle('filmy:detect-players', function () {
    return playersWin.detectPlayers();
  });
  ipcMain.handle('filmy:launch-player', function (event, opts) {
    if (!opts || typeof opts !== 'object') return { ok: false, error: 'Neplatná požiadavka.' };
    var player = String(opts.player || '');
    var p = String(opts.path || '');
    if (player !== 'mpc' && player !== 'vlc') return { ok: false, error: 'Neznámy prehrávač.' };
    if (!p || p.length > 1024 || /[\r\n]/.test(p)) return { ok: false, error: 'Neplatná cesta.' };
    return playersWin.launchPlayer({ player: player, path: p });
  });

  /* Embedded MPC — reparent the player window into the app window */
  function validRect(r) {
    return r && ['x', 'y', 'width', 'height'].every(function (k) {
      return typeof r[k] === 'number' && isFinite(r[k]) && r[k] >= -100;
    }) && r.width >= 100 && r.height >= 100 && r.width <= 16384 && r.height <= 16384;
  }
  function parentHandle() {
    if (!mainWindow) return null;
    try {
      return Number(mainWindow.getNativeWindowHandle().readBigUInt64LE(0));
    } catch (e) { return null; }
  }
  ipcMain.handle('filmy:embed-play', function (event, opts) {
    if (process.platform !== 'win32') return { ok: false, error: 'Vnorené prehrávanie je len pre Windows.' };
    if (!opts || typeof opts !== 'object') return { ok: false, error: 'Neplatná požiadavka.' };
    if (String(opts.player || '') !== 'mpc') return { ok: false, error: 'Vnoriť možno len MPC.' };
    var p = String(opts.path || '');
    if (!p || p.length > 1024 || /[\r\n]/.test(p)) return { ok: false, error: 'Neplatná cesta.' };
    if (!validRect(opts.rect)) return { ok: false, error: 'Neplatná oblasť videa.' };
    var ph = parentHandle();
    if (!ph) return { ok: false, error: 'Okno aplikácie nie je pripravené.' };
    return embedWin.play({ path: p, rect: opts.rect, parentHandle: ph });
  });
  ipcMain.handle('filmy:embed-move', function (event, opts) {
    if (!opts || !validRect(opts.rect)) return { ok: false };
    return embedWin.move(opts.rect);
  });
  ipcMain.handle('filmy:embed-stop', function () {
    return embedWin.stop();
  });
  ipcMain.handle('filmy:embed-status', function () {
    return embedWin.status();
  });
}

/* ── Window state persistence ── */
function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}
function loadWindowState() {
  try {
    var s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (s && s.width >= 420 && s.height >= 400) return s;
  } catch (e) { /* first run or corrupt state */ }
  return null;
}
function saveWindowState() {
  if (!mainWindow) return;
  try {
    var maximized = mainWindow.isMaximized();
    var b = maximized ? loadWindowState() || mainWindow.getNormalBounds() : mainWindow.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({
      x: b.x, y: b.y, width: b.width, height: b.height, maximized: maximized
    }));
  } catch (e) { /* best effort */ }
}

/* ── Main window: URL-first with offline local fallback ── */
function createWindow() {
  var state = loadWindowState() || {};
  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width || 1280,
    height: state.height || 860,
    minWidth: 420,
    minHeight: 600,
    title: 'Filmy',
    icon: path.join(WEB_ROOT, 'icon-512.png'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });
  if (state.maximized) mainWindow.maximize();

  loadProd();

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  ['resize', 'move', 'maximize', 'unmaximize', 'close'].forEach(function (evt) {
    mainWindow.on(evt, saveWindowState);
  });

  mainWindow.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // If the network drops mid-session, fall back to the bundled copy.
  mainWindow.webContents.on('did-fail-load', function (event, errorCode, errorDescription, validatedURL) {
    if (!usingLocal && validatedURL && validatedURL.indexOf(PROD_URL) === 0) {
      loadLocal();
    }
  });

  mainWindow.on('closed', function () {
    embedWin.stop(); // do not leave an orphaned embedded MPC behind
    mainWindow = null;
  });
}

function loadProd() {
  usingLocal = false;
  mainWindow.loadURL(PROD_URL).catch(function () {
    loadLocal();
  });
}

function loadLocal() {
  usingLocal = true;
  mainWindow.loadURL(LOCAL_URL).catch(function () { /* nothing else to try */ });
}

/* ── Tray ── */
function createTray() {
  if (process.platform !== 'win32') return;
  try {
    tray = new Tray(path.join(WEB_ROOT, 'icon-192.png'));
    tray.setToolTip('Marcelova Filmová Databáza');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Zobraziť Filmy', click: function () { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Zavrieť', click: function () { app.quit(); } }
    ]));
    tray.on('click', function () {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (e) { /* tray is best-effort */ }
}

/* ── Windows jump list tasks ── */
function registerJumpList() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '',
        iconPath: process.execPath,
        iconIndex: 0,
        title: 'Otvoriť Filmy',
        description: 'Spustiť Filmovú Databázu'
      }
    ]);
  } catch (e) { /* best effort */ }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Filmy',
      submenu: [
        { label: 'Znovu načítať', role: 'reload' },
        { label: 'Vyčistiť cache a načítať', role: 'forceReload' },
        {
          label: 'Použiť lokálnu (offline) kópiu',
          click: function () { if (mainWindow) loadLocal(); }
        },
        {
          label: 'Použiť online verziu',
          click: function () { if (mainWindow) loadProd(); }
        },
        { type: 'separator' },
        { label: 'Zavrieť', role: 'quit' }
      ]
    },
    {
      label: 'Zobrazenie',
      submenu: [
        { label: 'Celá obrazovka', role: 'togglefullscreen' },
        { label: 'Priblížiť', role: 'zoomIn' },
        { label: 'Oddialiť', role: 'zoomOut' },
        { label: 'Pôvodná veľkosť', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'DevTools', role: 'toggleDevTools' }
      ]
    }
  ]);
}

app.on('before-quit', function () {
  embedWin.stop();
});

app.on('window-all-closed', function () {
  app.quit();
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
