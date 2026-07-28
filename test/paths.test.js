import { describe, it, expect } from 'vitest';
import { localPathToSmb, getMoviePath, smbToUnc } from '../src/lib/paths.js';

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
