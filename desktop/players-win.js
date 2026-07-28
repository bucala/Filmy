// Detection and launching of installed Windows video players (VLC, MPC-HC,
// MPC-BE) for the Filmy desktop app.
//
// Legal note: VLC (GPLv2+/LGPL), MPC-HC (GPLv3) and MPC-BE (GPLv3) are free,
// open-source players installed by the user on their own machine. We only
// launch them via the command line — no bundling, linking, or modification —
// which is ordinary inter-process communication and requires no extra license
// compliance.
const { execFile, spawn } = require('child_process');
const fs = require('fs');

// Keep in sync with smbToUnc() in src/lib/paths.js (the ES module cannot be
// require()d from this CommonJS main process).
function smbToUnc(p) {
  var s = String(p || '');
  if (s.indexOf('smb://') === 0) {
    return '\\\\' + s.substring(6).replace(/\//g, '\\');
  }
  return s.replace(/\//g, '\\');
}

function fileExists(p) {
  try { return !!p && fs.existsSync(p); } catch (e) { return false; }
}

function firstExisting(candidates) {
  for (var i = 0; i < candidates.length; i++) {
    if (fileExists(candidates[i])) return candidates[i];
  }
  return null;
}

// Runs `reg query <key> /v <value>` and returns the REG_SZ value, or null.
function regQueryValue(keyPath, valueName) {
  return new Promise(function (resolve) {
    execFile('reg', ['query', keyPath, '/v', valueName],
      { windowsHide: true, timeout: 4000 },
      function (err, stdout) {
        if (err) return resolve(null);
        // Output line looks like: "    InstallDir    REG_SZ    C:\Path"
        var m = String(stdout).match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)\r?$/m);
        resolve(m ? m[1].trim() : null);
      });
  });
}

function joinExe(dir, exe) {
  if (!dir) return null;
  var d = dir.replace(/["]/g, '').replace(/\\+$/, '');
  return d + '\\' + exe;
}

function progFilesDirs() {
  var dirs = [];
  if (process.env['ProgramFiles']) dirs.push(process.env['ProgramFiles']);
  if (process.env['ProgramFiles(x86)']) dirs.push(process.env['ProgramFiles(x86)']);
  if (!dirs.length) dirs.push('C:\\Program Files', 'C:\\Program Files (x86)');
  return dirs;
}

async function detectVlc() {
  var installDir = await regQueryValue('HKLM\\SOFTWARE\\VideoLAN\\VLC', 'InstallDir');
  var candidates = [joinExe(installDir, 'vlc.exe')];
  progFilesDirs().forEach(function (pf) {
    candidates.push(pf + '\\VideoLAN\\VLC\\vlc.exe');
  });
  return firstExisting(candidates);
}

async function detectMpcHc() {
  var exePath = await regQueryValue('HKLM\\SOFTWARE\\MPC-HC\\MPC-HC', 'ExePath');
  var candidates = [exePath];
  progFilesDirs().forEach(function (pf) {
    candidates.push(pf + '\\MPC-HC\\mpc-hc64.exe');
    candidates.push(pf + '\\MPC-HC\\mpc-hc.exe');
    candidates.push(pf + '\\K-Lite Codec Pack\\MPC-HC64\\mpc-hc64.exe');
  });
  return firstExisting(candidates);
}

async function detectMpcBe() {
  var exePath = await regQueryValue('HKLM\\SOFTWARE\\MPC-BE', 'ExePath');
  var candidates = [exePath];
  progFilesDirs().forEach(function (pf) {
    candidates.push(pf + '\\MPC-BE x64\\mpc-be64.exe');
    candidates.push(pf + '\\MPC-BE\\mpc-be.exe');
  });
  return firstExisting(candidates);
}

// Returns { vlc: <exe|null>, mpcHc: <exe|null>, mpcBe: <exe|null> }.
async function detectPlayers() {
  var results = await Promise.all([detectVlc(), detectMpcHc(), detectMpcBe()]);
  return { vlc: results[0], mpcHc: results[1], mpcBe: results[2] };
}

// Launches the chosen player with the given movie path. VLC accepts smb://
// URLs natively; MPC-HC/BE need a UNC path for network shares.
// Returns { ok, label?, exe?, error?, detected? }.
async function launchPlayer(opts) {
  var player = opts && opts.player;
  var filePath = String((opts && opts.path) || '');
  if (!filePath) return { ok: false, error: 'Prázdna cesta k súboru.' };

  var detected = await detectPlayers();
  var exe = null, label = '', arg = filePath;

  if (player === 'vlc') {
    exe = detected.vlc;
    label = 'VLC';
  } else if (player === 'mpc') {
    exe = detected.mpcHc || detected.mpcBe;
    label = detected.mpcHc ? 'MPC-HC' : 'MPC-BE';
    if (filePath.indexOf('smb://') === 0) arg = smbToUnc(filePath);
  } else {
    return { ok: false, error: 'Neznámy prehrávač: ' + player };
  }

  if (!exe) {
    return {
      ok: false,
      detected: detected,
      error: (player === 'vlc' ? 'VLC' : 'MPC-HC/BE') +
        ' nie je nainštalovaný (nenájdený v registri ani v štandardných cestách).'
    };
  }

  try {
    var child = spawn(exe, [arg], { detached: true, stdio: 'ignore' });
    child.on('error', function () { /* surfaced via exit, ignore */ });
    child.unref();
    return { ok: true, label: label, exe: exe };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = { detectPlayers: detectPlayers, launchPlayer: launchPlayer, smbToUnc: smbToUnc };
