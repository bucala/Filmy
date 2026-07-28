// Preload — exposes a minimal, safe native API to the renderer.
// contextIsolation stays on; the web app only sees window.filmyNative.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('filmyNative', {
  platform: process.platform,
  // -> { vlc: <exe|null>, mpcHc: <exe|null>, mpcBe: <exe|null> }
  detectPlayers: function () {
    return ipcRenderer.invoke('filmy:detect-players');
  },
  // opts: { player: 'mpc'|'vlc', path: string }
  // -> { ok, label?, exe?, error?, detected? }
  launchPlayer: function (opts) {
    return ipcRenderer.invoke('filmy:launch-player', opts);
  }
});
