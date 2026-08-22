import { describe, it, expect } from 'vitest';
import { localPathToSmb, getMoviePath, smbToUnc, buildAndroidLaunchUrl, MXPLAYER_PACKAGE } from '../src/lib/paths.js';

describe('smbToUnc', () => {
  it('converts an smb:// URL to a Windows UNC path', () => {
    expect(smbToUnc('smb://DESKTOP-EGOG348/Movies/2026 - Film.mkv'))
      .toBe('\\\\DESKTOP-EGOG348\\Movies\\2026 - Film.mkv');
  });
  it('converts forward slashes in local paths to backslashes', () => {
    expect(smbToUnc('W:/Movies/Film.mkv')).toBe('W:\\Movies\\Film.mkv');
  });
  it('passes through empty input', () => {
    expect(smbToUnc('')).toBe('');
    expect(smbToUnc(null)).toBe('');
  });
});

describe('localPathToSmb', () => {
  it('rewrites a path using an explicit local->smb mapping', () => {
    var smbMap = { 'W:\\Movies\\': 'smb://DESKTOP-EGOG348/Movies/' };
    expect(localPathToSmb('W:\\Movies\\2026 - Film.mkv', smbMap, 'smb://fallback/Movies/'))
      .toBe('smb://DESKTOP-EGOG348/Movies/2026 - Film.mkv');
  });

  it('matches a mapping case-insensitively', () => {
    var smbMap = { 'w:\\movies\\': 'smb://DESKTOP-EGOG348/Movies/' };
    expect(localPathToSmb('W:\\Movies\\Film.mkv', smbMap, ''))
      .toBe('smb://DESKTOP-EGOG348/Movies/Film.mkv');
  });

  it('falls back to a drive-letter swap against smbBase when no mapping matches', () => {
    expect(localPathToSmb('W:/Movies/2026 - Film.mkv', {}, 'smb://DESKTOP-EGOG348/Movies/'))
      .toBe('smb://DESKTOP-EGOG348/Movies/2026 - Film.mkv');
  });

  it('does not duplicate the base directory when it is already part of the local path', () => {
    // Regression: local path already contains "Movies/", base also ends in
    // "Movies/" — must not become ".../Movies/Movies/Film.mkv".
    expect(localPathToSmb('W:/Movies/Film.mkv', {}, 'smb://DESKTOP-EGOG348/Movies/'))
      .toBe('smb://DESKTOP-EGOG348/Movies/Film.mkv');
  });

  it('returns the path unchanged when it has no drive letter and matches no mapping', () => {
    expect(localPathToSmb('Movies/Film.mkv', {}, 'smb://DESKTOP-EGOG348/Movies/'))
      .toBe('Movies/Film.mkv');
  });
});

describe('getMoviePath', () => {
  var movie = { title: 'Jack Ryan', year: 2026, _localPath: 'W:\\Movies\\2026 - Jack Ryan.mkv' };

  it('normalizes backslashes in a stored local path', () => {
    expect(getMoviePath(movie, { pathMode: 'local' }))
      .toBe('W:/Movies/2026 - Jack Ryan.mkv');
  });

  it('builds a filename from title+year when no local path is stored', () => {
    expect(getMoviePath({ title: 'Jack Ryan', year: 2026 }, { pathMode: 'local' }))
      .toBe('W:/Movies/2026 - Jack Ryan.mkv');
  });

  it('converts to SMB when pathMode is smb', () => {
    expect(getMoviePath(movie, { pathMode: 'smb', smbMap: {}, smbBase: 'smb://DESKTOP-EGOG348/Movies/' }))
      .toBe('smb://DESKTOP-EGOG348/Movies/2026 - Jack Ryan.mkv');
  });
});

describe('buildAndroidLaunchUrl', () => {
  var smbPath = 'smb://DESKTOP-EGOG348/Movies/2026 - Jack Ryan.mkv';

  it('vlc: prefixes the vlc:// deep-link scheme and encodes the rest', () => {
    expect(buildAndroidLaunchUrl(smbPath, 'vlc'))
      .toBe('vlc://smb://DESKTOP-EGOG348/Movies/2026%20-%20Jack%20Ryan.mkv');
  });

  it('defaults to the vlc:// behaviour when no player is set (preserves existing installs)', () => {
    expect(buildAndroidLaunchUrl(smbPath, undefined))
      .toBe(buildAndroidLaunchUrl(smbPath, 'vlc'));
  });

  it('mxplayer: builds an intent:// URI with an explicit package and the ORIGINAL scheme, unmangled', () => {
    var url = buildAndroidLaunchUrl(smbPath, 'mxplayer');
    expect(url).toBe(
      'intent://DESKTOP-EGOG348/Movies/2026%20-%20Jack%20Ryan.mkv' +
      '#Intent;scheme=smb;package=' + MXPLAYER_PACKAGE +
      ';action=android.intent.action.VIEW;type=video/*;end'
    );
  });

  it('mxplayer: falls back to an assumed smb scheme for a bare (schemeless) path', () => {
    var url = buildAndroidLaunchUrl('DESKTOP-EGOG348/Movies/Film.mkv', 'mxplayer');
    expect(url).toContain('scheme=smb');
    expect(url).toContain('package=' + MXPLAYER_PACKAGE);
  });

  it('other: returns the raw path, cleanly encoded, with no scheme mangling', () => {
    expect(buildAndroidLaunchUrl(smbPath, 'other'))
      .toBe('smb://DESKTOP-EGOG348/Movies/2026%20-%20Jack%20Ryan.mkv');
  });

  it('returns an empty string for empty input', () => {
    expect(buildAndroidLaunchUrl('', 'vlc')).toBe('');
    expect(buildAndroidLaunchUrl(null, 'mxplayer')).toBe('');
  });
});
