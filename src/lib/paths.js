/* Pure movie-file path helpers — no DOM, no shared state. Unit-tested in
   test/. Extracted from players.js so the SMB/local path resolution logic
   (the exact area that caused the MPC/VLC playback bugs) can be tested
   without needing a browser environment. */
import { buildMovieFilename, normalizeSlashes } from './text.js';

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
