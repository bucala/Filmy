// Preload — exposes a minimal, safe native API to the renderer.
// contextIsolation stays on; the web app only sees window.filmyNative.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('filmyNative', {
  platform: process.platform,
  copyPickFolder: role => ipcRenderer.invoke('filmy:copy-pick', role),
  copyStart: items => ipcRenderer.invoke('filmy:copy-start', items),
  copyStatus: () => ipcRenderer.invoke('filmy:copy-status'),
  copyCancel: () => ipcRenderer.invoke('filmy:copy-cancel'),
  onCopyProgress: callback => {
    const listener = (event, snapshot) => callback(snapshot);
    ipcRenderer.on('filmy:copy-progress', listener);
    return () => ipcRenderer.removeListener('filmy:copy-progress', listener);
  },
  // -> { vlc: <exe|null>, mpcHc: <exe|null>, mpcBe: <exe|null> }
  detectPlayers: function () {
    return ipcRenderer.invoke('filmy:detect-players');
  },
  // opts: { player: 'mpc'|'vlc', path: string }
  // -> { ok, label?, exe?, error?, detected? }
  launchPlayer: function (opts) {
    return ipcRenderer.invoke('filmy:launch-player', opts);
  },
  // Embedded MPC: reparent the player window into the app window.
  // rect: { x, y, width, height } in device pixels, relative to the window
  // client area (renderer multiplies by devicePixelRatio before sending).
  // opts: { player: 'mpc', path: string, rect }
  // -> { ok, label?, exe?, error? }
  embedPlay: function (opts) {
    return ipcRenderer.invoke('filmy:embed-play', opts);
  },
  // opts: { rect } — reposition the embedded player (window resize)
  embedMove: function (opts) {
    return ipcRenderer.invoke('filmy:embed-move', opts);
  },
  // -> void — close the embedded player
  embedStop: function () {
    return ipcRenderer.invoke('filmy:embed-stop');
  },
  // -> boolean — true while the embedded player window still exists
  embedStatus: function () {
    return ipcRenderer.invoke('filmy:embed-status');
  }
});
