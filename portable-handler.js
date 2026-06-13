/* ══════════════════════════════════════════════════════════
   MODULE: Portable Player Support
   Handles launching portable MPC-HC or VLC from W:\
   ══════════════════════════════════════════════════════════ */

var PORTABLE_KEY     = 'mdb_portable_mode';   // 'off' | 'mpc' | 'vlc'
var PORTABLE_MPC_KEY = 'mdb_portable_mpc';   // path to mpc-hc64.exe
var PORTABLE_VLC_KEY = 'mdb_portable_vlc';   // path to vlc-portable.exe

var portableMode = localStorage.getItem(PORTABLE_KEY) || 'off';
var portableMpcPath = localStorage.getItem(PORTABLE_MPC_KEY) || 'W:\\MPC-portable\\mpc-hc64.exe';
var portableVlcPath = localStorage.getItem(PORTABLE_VLC_KEY) || 'W:\\vlc-portable\\vlc-portable.exe';

/**
 * Returns the path to the portable exe for the given mode ('mpc'|'vlc')
 */
function getPortableExe(mode) {
  return mode === 'vlc' ? portableVlcPath : portableMpcPath;
}

/**
 * Build a portable launch URL.
 * Uses shell: protocol or direct bat invocation via mpc:// fallback.
 * On Windows, the safest cross-browser approach is a custom protocol handler.
 * We generate a special "portable://" URL that the .reg handler intercepts.
 * Fallback: copy path to clipboard.
 */
function launchPortable(moviePath, mode) {
  var exe = getPortableExe(mode || portableMode);
  // Encode as portable:// URL: portable://exe=W:\path\mpc.exe&file=W:\Movies\film.mkv
  var url = 'portable://launch?exe=' + encodeURIComponent(exe) + '&file=' + encodeURIComponent(moviePath);
  // Also try shell: on Edge/IE (legacy)
  var shellCmd = exe + ' "' + moviePath + '"';
  // Copy command to clipboard as fallback
  try { navigator.clipboard.writeText(shellCmd); } catch(e) {}
  // Attempt to open via portable:// handler
  window.location.href = url;
  return shellCmd;
}

/**
 * Generate .reg file content for registering the portable:// handler.
 * The handler runs a bat file that parses the URL and launches the correct exe.
 */
function generatePortableReg(exePath, batPath) {
  batPath = batPath || 'W:\\Portable-Handler\\launch.bat';
  return 'Windows Registry Editor Version 5.00\r\n\r\n' +
    '[HKEY_CLASSES_ROOT\\portable]\r\n' +
    '"URL Protocol"=""\r\n' +
    '@="Portable Player Handler"\r\n\r\n' +
    '[HKEY_CLASSES_ROOT\\portable\\shell]\r\n\r\n' +
    '[HKEY_CLASSES_ROOT\\portable\\shell\\open]\r\n\r\n' +
    '[HKEY_CLASSES_ROOT\\portable\\shell\\open\\command]\r\n' +
    '@="\\"' + batPath.replace(/\\/g, '\\\\') + '\\" \\"%1\\""\r\n';
}

/**
 * Generate .bat file content for the portable:// handler.
 * Parses the URL and launches the correct exe.
 */
function generatePortableBat(mpcPath, vlcPath) {
  mpcPath = mpcPath || portableMpcPath;
  vlcPath = vlcPath || portableVlcPath;
  return '@echo off\r\n' +
    'setlocal enabledelayedexpansion\r\n' +
    'set URL=%~1\r\n' +
    ':: Decode URL-encoded spaces and parse params\r\n' +
    'set URL=!URL:portable://launch?=!\r\n' +
    ':: Extract exe= param\r\n' +
    'for /f "tokens=1,* delims==" %%a in ("!URL!") do set PARAMS=%%b\r\n' +
    ':: Simple approach: check if URL contains vlc\r\n' +
    'echo !URL! | findstr /i "vlc" >nul\r\n' +
    'if !errorlevel! == 0 (\r\n' +
    '  set EXE=' + vlcPath + '\r\n' +
    ') else (\r\n' +
    '  set EXE=' + mpcPath + '\r\n' +
    ')\r\n' +
    ':: Extract file path from URL (after &file=)\r\n' +
    'for /f "tokens=2 delims==" %%a in ("!URL!") do set FILEPATH=%%a\r\n' +
    ':: Remove %xx encoding for common chars\r\n' +
    'set FILEPATH=!FILEPATH:%%5C=\\!\r\n' +
    'set FILEPATH=!FILEPATH:%%3A=:!\r\n' +
    'set FILEPATH=!FILEPATH:%%20= !\r\n' +
    ':: Strip trailing junk after &\r\n' +
    'for /f "tokens=1 delims=&" %%a in ("!FILEPATH!") do set FILEPATH=%%a\r\n' +
    'start "" "!EXE!" "!FILEPATH!"\r\n';
}

/**
 * Download the .reg file for portable:// handler registration
 */
function downloadPortableReg() {
  var batPath = 'W:\\Portable-Handler\\launch.bat';
  var content = generatePortableReg(null, batPath);
  var blob = new Blob([content], {type: 'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'register-portable.reg';
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Download the .bat file for the portable:// handler
 */
function downloadPortableBat() {
  var content = generatePortableBat(portableMpcPath, portableVlcPath);
  var blob = new Blob([content], {type: 'text/plain'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'launch.bat';
  a.click();
  URL.revokeObjectURL(a.href);
}
