/* Pure movie-file path helpers — no DOM, no shared state. Unit-tested in
   test/. Extracted from players.js so the SMB/local path resolution logic
   (the exact area that caused the MPC/VLC playback bugs) can be tested
   without needing a browser environment. */
import { buildMovieFilename, normalizeSlashes } from './text.js';

/* Converts an smb://server/share/path URL to a Windows UNC path
   (\\server\share\path). Non-SMB input is returned with backslashes only.
   Used for MPC-HC/BE launches and clipboard copies on Windows.
   NOTE: keep in sync with the copy in desktop/players-win.js (CommonJS
   main process cannot import this ES module). */
export function smbToUnc(p) {
  var s = String(p || '');
  if (s.indexOf('smb://') === 0) {
    return '\\\\' + s.substring(6).replace(/\//g, '\\');
  }
  return s.replace(/\//g, '\\');
}

/* Rewrites a local Windows/UNC-ish path to its SMB equivalent using an
   explicit local->smb map first, falling back to a drive-letter swap
   against smbBase when no mapping matches. */
export function localPathToSmb(localPath, smbMap, smbBase) {
  var p = normalizeSlashes(localPath);
  for (var local in smbMap) {
    var localNorm = normalizeSlashes(local);
    if (localNorm[localNorm.length - 1] !== '/') localNorm += '/';
    if (p.indexOf(localNorm) === 0 || p.toLowerCase().indexOf(localNorm.toLowerCase()) === 0) {
      var smbVal = smbMap[local];
      if (smbVal[smbVal.length - 1] !== '/') smbVal += '/';
      return smbVal + p.substring(localNorm.length);
    }
  }
  var driveMatch = p.match(/^([A-Za-z]):\//);
  if (driveMatch) {
    var base = smbBase;
    if (base[base.length - 1] !== '/') base += '/';
    var afterDrive = p.substring(3);
    var baseDir = base.replace(/^smb:\/\/[^/]+\//, '');
    if (baseDir && afterDrive.indexOf(baseDir) === 0) {
      afterDrive = afterDrive.substring(baseDir.length);
    }
    return base + afterDrive;
  }
  return p;
}

/* Resolves the path used to launch a movie: the stored/manual local path
   (or a filename built from title+year as a fallback), converted to SMB
   when pathMode is 'smb'. */
export function getMoviePath(movie, opts) {
  opts = opts || {};
  var rawPath = movie._localPath || '';
  if (!rawPath) {
    rawPath = 'W:/Movies/' + buildMovieFilename(movie);
  } else {
    rawPath = rawPath.replace(/\\/g, '/');
  }
  if (opts.pathMode === 'smb') {
    return localPathToSmb(rawPath, opts.smbMap, opts.smbBase);
  }
  return rawPath;
}

/* MX Player Pro's package name, for explicit-package launches — see
   buildAndroidLaunchUrl(). MX Player's own documented Intent contract is
   ACTION_VIEW + video/* + an explicit package, not a custom scheme trick. */
export var MXPLAYER_PACKAGE = 'com.mxtech.videoplayer.pro';

/* Builds the URL handed to window.location.href to launch an external
   player on Android, honouring the user's chosen player (S.androidPlayer):
   - 'vlc'      → vlc://<path>. VLC's own deep-link convention: VLC strips
     the vlc:// prefix and opens the remainder (e.g. smb://...) itself.
     Proven to work; kept as the default so existing installs don't regress.
   - 'mxplayer' → an intent:// URI (Android's own "intent scheme" format,
     already handled by MainActivity's shouldOverrideUrlLoading) that
     explicitly targets MX Player Pro by package and carries the ORIGINAL
     scheme (smb/file/...) as a clean, unmangled data URI — unlike the vlc://
     trick, MX Player never sees a corrupted double-scheme URI. Whether MX
     Player can actually stream an smb:// path isn't publicly documented;
     if not, the "Iný / Kopírovať cestu" choice is the fallback.
   - anything else ('other') → the raw path as-is, letting Android resolve
     it via a normal implicit ACTION_VIEW (system chooser / default app) —
     no scheme mangling, so any player that does register for the path's
     native scheme can pick it up. */
export function buildAndroidLaunchUrl(path, androidPlayer) {
  var p = String(path || '');
  if (!p) return '';
  if (androidPlayer === 'mxplayer') {
    var m = p.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/);
    var scheme = m ? m[1] : 'smb';
    var rest = m ? m[2] : p;
    return 'intent://' + encodeURI(rest) +
      '#Intent;scheme=' + scheme + ';package=' + MXPLAYER_PACKAGE +
      ';action=android.intent.action.VIEW;type=video/*;end';
  }
  if (!androidPlayer || androidPlayer === 'vlc') {
    return 'vlc://' + encodeURI(p);
  }
  return encodeURI(p);
}
