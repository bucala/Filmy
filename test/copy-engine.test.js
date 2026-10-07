import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { createCopyEngine } = require('../desktop/copy-engine.js');
const { trustedSender } = require('../desktop/copy-ipc.js');
let root, source, destination;
const item = (name, candidates = [name], id = name) => ({ id, title: name, name, candidates });
const hash = data => createHash('sha256').update(data).digest('hex');

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'filmy-copy-test-'));
  source = path.join(root, 'source'); destination = path.join(root, 'destination');
  await mkdir(source); await mkdir(destination);
});
afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function copier(progress) {
  const engine = createCopyEngine(progress);
  await engine.setRoot('source', source); await engine.setRoot('destination', destination);
  return engine;
}

describe('native file copying with real temporary files', () => {
  it('copies nested/relocated source files byte-for-byte without replacing existing files', async () => {
    await mkdir(path.join(source, 'Sci-Fi'));
    const contents = Buffer.from('Actual file bytes, Železný obor.');
    await writeFile(path.join(source, 'Sci-Fi', 'Film.mkv'), contents);
    await writeFile(path.join(destination, 'Film.mkv'), 'existing, preserve me');
    const updates = [];
    const engine = await copier(snapshot => updates.push(snapshot));
    engine.start([item('Film.mkv', ['Movies/Sci-Fi/Film.mkv', 'Sci-Fi/Film.mkv', 'Film.mkv'])]);
    const result = await engine.wait();
    expect(result.phase).toBe('done'); expect(result.copied).toBe(1);
    expect(result.totalBytes).toBe(contents.length); expect(result.transferredBytes).toBe(contents.length);
    expect(hash(await readFile(path.join(destination, result.target, 'Film.mkv')))).toBe(hash(contents));
    expect(await readFile(path.join(destination, 'Film.mkv'), 'utf8')).toBe('existing, preserve me');
    expect(await readFile(path.join(source, 'Sci-Fi', 'Film.mkv'))).toEqual(contents);
    expect(updates.some(s => s.phase === 'copying')).toBe(true);
  });

  it('reports missing files, traversal and duplicate names truthfully', async () => {
    await writeFile(path.join(source, 'Film.mkv'), 'film');
    await writeFile(path.join(root, 'outside.mkv'), 'outside');
    const engine = await copier();
    engine.start([item('Film.mkv'), item('Film.mkv', ['Film.mkv'], 'duplicate'),
      item('Missing.mkv'), item('outside.mkv', ['../outside.mkv'])]);
    const result = await engine.wait();
    expect(result.copied).toBe(1); expect(result.skipped).toBe(1); expect(result.failed).toBe(2);
    expect(await readdir(path.join(destination, result.target))).toEqual(['Film.mkv']);
  });

  it('refuses symlinks that escape the selected tree', async () => {
    const outside = path.join(root, 'outside');
    await mkdir(outside); await writeFile(path.join(outside, 'Film.mkv'), 'secret outside');
    // A Windows directory junction is creatable without admin privileges.
    await symlink(outside, path.join(source, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    const engine = await copier();
    engine.start([item('Film.mkv', ['link/Film.mkv'])]);
    const result = await engine.wait();
    expect(result.copied).toBe(0); expect(result.failed).toBe(1);
    expect(await readdir(destination)).toEqual([]);
  });

  it('rejects parallel jobs and changing roots during a transfer', async () => {
    await writeFile(path.join(source, 'Film.mkv'), Buffer.alloc(1024 * 1024));
    const engine = await copier();
    engine.start([item('Film.mkv')]);
    expect(() => engine.start([item('Film.mkv')])).toThrow('už prebieha');
    await expect(engine.setRoot('source', destination)).rejects.toThrow('už prebieha');
    await engine.wait();
  });

  it('cancels during actual byte transfer, removes only the partial file, and preserves originals', async () => {
    const original = Buffer.alloc(64 * 1024 * 1024, 73);
    await writeFile(path.join(source, 'Large.mkv'), original);
    await writeFile(path.join(destination, 'Large.mkv'), 'original destination');
    const engine = await copier();
    engine.start([item('Large.mkv')]);
    const timer = setInterval(() => {
      if (engine.status().transferredBytes > 0) engine.cancel();
    }, 1);
    let result;
    try { result = await engine.wait(); } finally { clearInterval(timer); }
    expect(result.phase).toBe('cancelled');
    expect(result.transferredBytes).toBeGreaterThan(0);
    expect(result.copied).toBe(0);
    expect(await readdir(path.join(destination, result.target))).toEqual([]);
    expect(hash(await readFile(path.join(source, 'Large.mkv')))).toBe(hash(original));
    expect(await readFile(path.join(destination, 'Large.mkv'), 'utf8')).toBe('original destination');
  });

  it('works when source and destination are the same selected directory', async () => {
    await writeFile(path.join(source, 'Film.mkv'), 'keep source');
    const engine = await copier();
    await engine.setRoot('destination', source);
    engine.start([item('Film.mkv')]);
    const result = await engine.wait();
    expect(result.copied).toBe(1);
    expect(await readFile(path.join(source, 'Film.mkv'), 'utf8')).toBe('keep source');
    expect(await readFile(path.join(source, result.target, 'Film.mkv'), 'utf8')).toBe('keep source');
  });

  it('rejects a source that grows after its first copied chunk and removes the truncated destination', async () => {
    const original = Buffer.alloc(8 * 1024 * 1024, 42);
    const file = path.join(source, 'Growing.mkv');
    await writeFile(file, original);
    let grew = false;
    const engine = await copier(snapshot => {
      if (!grew && snapshot.phase === 'copying' && snapshot.transferredBytes > 0) {
        grew = true;
        appendFileSync(file, 'new source bytes');
      }
    });
    engine.start([item('Growing.mkv')]);
    const result = await engine.wait();
    expect(grew).toBe(true);
    expect(result.copied).toBe(0); expect(result.failed).toBe(1);
    expect(result.items[0].error).toContain('zväčšil');
    expect(await readdir(path.join(destination, result.target))).toEqual([]);
    expect(hash(await readFile(file))).toBe(hash(Buffer.concat([original, Buffer.from('new source bytes')])));
  });

  it('throttles a large fast scan without losing its final item failures', async () => {
    const updates = [];
    const engine = await copier(snapshot => updates.push(snapshot));
    engine.start(Array.from({ length: 200 }, (_, i) => item('Missing-' + i + '.mkv')));
    const result = await engine.wait();
    expect(result.failed).toBe(200);
    expect(updates.filter(snapshot => snapshot.phase === 'scanning').length)
      .toBeLessThan(Math.ceil(result.elapsedMs / 100) + 2);
    expect(updates.at(-1).phase).toBe('done');
    expect(updates.at(-1).items.every(item => item.state === 'error')).toBe(true);
  });

  it('never creates a destination folder when every source is missing', async () => {
    const engine = await copier(); engine.start([item('Missing.mkv')]);
    expect((await engine.wait()).failed).toBe(1);
    expect(await readdir(destination)).toEqual([]);
  });

  it('does not rename an unrelated source file into a video', async () => {
    await writeFile(path.join(source, 'secret.txt'), 'not a movie');
    const engine = await copier(); engine.start([item('Film.mkv', ['secret.txt'])]);
    expect((await engine.wait()).failed).toBe(1);
    expect(await readdir(destination)).toEqual([]);
  });
});

describe('copy IPC origin/frame boundary', () => {
  const origin = 'https://filmy-iota.vercel.app';
  const frame = { url: origin + '/' }, contents = { mainFrame: frame }, window = { webContents: contents };
  it('permits only the owned main frame on the app origins', () => {
    expect(trustedSender({ sender: contents, senderFrame: frame }, window, origin)).toBe(true);
    expect(trustedSender({ sender: {}, senderFrame: frame }, window, origin)).toBe(false);
    expect(trustedSender({ sender: contents, senderFrame: { url: origin + '/' } }, window, origin)).toBe(false);
    for (const url of ['https://evil.test/', 'https://filmy-iota.vercel.app.evil.test/', 'file:///Film.mkv']) {
      frame.url = url;
      expect(trustedSender({ sender: contents, senderFrame: frame }, window, origin)).toBe(false);
    }
    frame.url = 'app://local/index.html';
    expect(trustedSender({ sender: contents, senderFrame: frame }, window, origin)).toBe(true);
    frame.url = origin + '/';
  });
});
