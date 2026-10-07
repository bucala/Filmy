const { createCopyEngine } = require('./copy-engine');

function trustedSender(event, window, productionUrl) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return url.origin === new URL(productionUrl).origin || (url.protocol === 'app:' && url.hostname === 'local');
  } catch { return false; }
}

function registerCopyIpc({ ipcMain, dialog, getWindow, productionUrl }) {
  const engine = createCopyEngine(snapshot => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      if (!window.webContents.isDestroyed() && trustedSender({
        sender: window.webContents, senderFrame: window.webContents.mainFrame
      }, window, productionUrl)) window.webContents.send('filmy:copy-progress', snapshot);
      window.setProgressBar(snapshot.phase === 'copying' && snapshot.totalBytes
        ? Math.min(1, snapshot.transferredBytes / snapshot.totalBytes) : -1);
    }
  });
  function handle(channel, action) {
    ipcMain.handle(channel, async (event, payload) => {
      if (!trustedSender(event, getWindow(), productionUrl)) return { ok: false, error: 'Nepovolený prístup ku kopírovaniu.' };
      try { return await action(payload); } catch (e) { return { ok: false, error: e.message }; }
    });
  }
  handle('filmy:copy-pick', async role => {
    if (role !== 'source' && role !== 'destination') throw new Error('Neplatný priečinok.');
    const result = await dialog.showOpenDialog(getWindow(), {
      title: role === 'source' ? 'Vyber zdrojový priečinok filmov' : 'Vyber cieľový priečinok',
      properties: ['openDirectory']
    });
    return result.canceled ? { ok: false, cancelled: true } : engine.setRoot(role, result.filePaths[0]);
  });
  handle('filmy:copy-start', items => engine.start(items));
  handle('filmy:copy-status', () => engine.status());
  handle('filmy:copy-cancel', () => engine.cancel());
  return engine;
}

module.exports = { registerCopyIpc, trustedSender };
