import { describe, expect, it } from 'vitest';
import { copyItem, copyFolderName, validCopyName, createCopyMeter, formatBytes, formatCopyTime } from '../src/lib/copy.js';

describe('copy selection and real transfer measurements', () => {
  it('uses the actual local filename and most-specific relative paths first', () => {
    expect(copyItem({ id: 1, title: 'Film', _localPath: 'W:\\Movies\\Sci-Fi\\1999 - Film.mp4' })).toEqual({
      id: '1', title: 'Film', name: '1999 - Film.mp4',
      candidates: ['Movies/Sci-Fi/1999 - Film.mp4', 'Sci-Fi/1999 - Film.mp4', '1999 - Film.mp4']
    });
  });

  it('falls back to the existing filename convention, not the movie title alone', () => {
    expect(copyItem({ id: 2, title: 'Železný obor', year: 1999 }).name).toBe('1999 - Zelezny obor.mkv');
  });

  it('rejects traversal, protocol paths and NTFS alternate streams', () => {
    for (const path of ['W:/Movies/../Film.mkv', 'smb://host/Film.mkv', 'W:/Movies/Film.mkv:ads', 'bad\n.mkv']) {
      expect(copyItem({ id: 1, _localPath: path }).invalid).toBe(true);
    }
  });

  it.each(['movie.exe', 'CON.mkv', 'NUL.mp4', '../movie.mkv', 'movie.mkv ', 'movie.mkv:ads'])(
    'rejects an unsafe destination name %s', name => expect(validCopyName(name)).toBe(false)
  );

  it('creates a unique portable destination directory name', () => {
    expect(copyFolderName(new Date('2026-10-06T18:20:30Z'), '12345678')).toBe('Filmy-20261006-182030-12345678');
  });

  it('does not invent an ETA until bytes have actually been transferred', () => {
    const measure = createCopyMeter();
    expect(measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 0 }, 0).eta).toBeNull();
    const next = measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 250 }, 1000);
    expect(next.rate).toBe(250);
    expect(next.percent).toBe(25);
    expect(next.eta).toBe(3);
  });

  it('drops the speed and ETA after a genuine I/O stall', () => {
    const measure = createCopyMeter();
    measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 0 }, 0);
    measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 250 }, 1000);
    measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 250 }, 5000);
    const stalled = measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 250 }, 6000);
    expect(stalled.rate).toBe(0);
    expect(stalled.eta).toBeNull();
  });

  it('resets measurement for a new job and never estimates completed work', () => {
    const measure = createCopyMeter();
    measure({ jobId: 'a', phase: 'copying', totalBytes: 1000, transferredBytes: 600 }, 1000);
    expect(measure({ jobId: 'b', phase: 'copying', totalBytes: 2000, transferredBytes: 0 }, 2000).rate).toBe(0);
    const done = measure({ jobId: 'b', phase: 'done', totalBytes: 2000, transferredBytes: 2000 }, 3000);
    expect(done.percent).toBe(100);
    expect(done.eta).toBeNull();
  });

  it('freezes elapsed time after completion and does not show 100% for an all-missing job', () => {
    const measure = createCopyMeter();
    measure({ jobId: 'a', phase: 'copying', transferredBytes: 100 }, 1000);
    expect(measure({ jobId: 'a', phase: 'done', elapsedMs: 1234, totalBytes: 0, copied: 0 }, 9000).elapsed).toBe(1.234);
    expect(measure({ jobId: 'b', phase: 'done', totalBytes: 0, copied: 0, failed: 1 }, 10000).percent).toBe(0);
  });

  it('formats binary byte units and time without fake precision', () => {
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatCopyTime(61)).toBe('01:01');
    expect(formatCopyTime(3661)).toBe('1:01:01');
    expect(formatCopyTime(NaN)).toBe('Meriam…');
  });
});
