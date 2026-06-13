const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const PROD_URL = 'https://filmy-iota.vercel.app';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    title: 'Filmy',
    icon: path.join(__dirname, '..', 'icon-512.png'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadURL(PROD_URL).catch(function () {
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  });

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  Menu.setApplicationMenu(buildMenu());
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Filmy',
      submenu: [
        { label: 'Znovu načítať', role: 'reload' },
        { label: 'Vyčistiť cache a načítať', role: 'forceReload' },
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

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  app.quit();
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
