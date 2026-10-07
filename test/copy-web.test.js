import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebCopier } from '../src/lib/copy-web.js';
import { createHash } from 'node:crypto';

// Unit doubles model failures and permissions that are impractical to induce
// on demand. Actual browser filesystem copying is checked separately in OPFS.
function directory(name) {
  const files = new Map(), directories = new Map();
  const handle = {
    name, files, directories, failWrite: false, failCleanup: false,
    async getDirectoryHandle(child, options = {}) {
      if (!directories.has(child)) {
        if (!options.create) throw new DOMException('Missing', 'NotFoundError');
        directories.set(child, directory(child));
      }
      return directories.get(child);
    },
    async getFileHandle(child, options = {}) {
      if (!files.has(child)) {
        if (!options.create) throw new DOMException('Missing', 'NotFoundError');
        files.set(child, new File([], child));
      }
      return {
        async getFile() { return files.get(child); },
        async createWritable() {
          const chunks = [];
          return {
            async write(chunk) {
              if (handle.failWrite) throw new DOMException('Disk full', 'QuotaExceededError');
              chunks.push(chunk);
            },
            async close() { files.set(child, new File(chunks, child)); },
            async abort() {}
          };
        }
      };
    },
    async removeEntry(child) {
      if (handle.failCleanup) throw new DOMException('Cleanup denied', 'NotAllowedError');
      files.delete(child);
    }
  };
  return handle;
}
const item = (name, candidates = [name]) => ({ id: name, title: name, name, candidates });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup() {
  const source = directory('source'), destination = directory('destination');
  const copier = createWebCopier();
  copier.setRoots(source, destination);
  return { source, destination, copier };
}

describe('browser permission-based transfer', () => {
  it('requests read access to source and write access to destination', async () => {
    const picker = vi.fn().mockResolvedValue(directory('selected'));
    vi.stubGlobal('window', { showDirectoryPicker: picker });
    const copier = createWebCopier();
    await copier.pick('source'); await copier.pick('destination');
    expect(picker.mock.calls.map(call => call[0].mode)).toEqual(['read', 'readwrite']);
  });

  it('writes all bytes in bounded chunks and preserves existing destination files', async () => {
    const { source, destination, copier } = setup();
    source.files.set('Film.mkv', new File([new Uint8Array(5 * 1024 * 1024).fill(23)], 'Film.mkv'));
    destination.files.set('Film.mkv', new File(['existing'], 'Film.mkv'));
    const updates = [];
    const result = await copier.start([item('Film.mkv')], snapshot => updates.push(snapshot));
    expect(result.copied).toBe(1); expect(result.transferredBytes).toBe(5 * 1024 * 1024);
    const output = await destination.directories.get(result.target).files.get('Film.mkv').arrayBuffer();
    const hash = data => createHash('sha256').update(new Uint8Array(data)).digest('hex');
    expect(hash(output)).toBe(hash(new Uint8Array(5 * 1024 * 1024).fill(23)));
    expect(await destination.files.get('Film.mkv').text()).toBe('existing');
    expect(updates.some(snapshot => snapshot.transferredBytes === 4 * 1024 * 1024)).toBe(true);
  });

  it('finds only the exact known relative path or filename in the granted source', async () => {
    const { source, destination, copier } = setup();
    const nested = await source.getDirectoryHandle('Movies', { create: true });
    nested.files.set('Film.mp4', new File(['movie'], 'Film.mp4'));
    const result = await copier.start([item('Film.mp4', ['Movies/Film.mp4', 'Film.mp4']),
      item('Missing.mkv'), item('Escape.mkv', ['../Escape.mkv'])], () => {});
    expect(result.copied).toBe(1); expect(result.failed).toBe(2);
    expect([...destination.directories.get(result.target).files.keys()]).toEqual(['Film.mp4']);
  });

  it('cannot relabel an unrelated source file as a movie', async () => {
    const { source, copier } = setup();
    source.files.set('secret.txt', new File(['not a movie'], 'secret.txt'));
    const result = await copier.start([item('Film.mkv', ['secret.txt'])], () => {});
    expect(result.copied).toBe(0); expect(result.failed).toBe(1);
  });

  it('cancels on a real chunk boundary and cleans only the new partial file', async () => {
    const { source, destination, copier } = setup();
    source.files.set('Film.mkv', new File([new Uint8Array(5 * 1024 * 1024)], 'Film.mkv'));
    const result = await copier.start([item('Film.mkv')], snapshot => {
      if (snapshot.phase === 'copying' && snapshot.transferredBytes > 0) copier.cancel();
    });
    expect(result.phase).toBe('cancelled'); expect(result.copied).toBe(0);
    expect(destination.directories.get(result.target).files.size).toBe(0);
    expect(source.files.get('Film.mkv').size).toBe(5 * 1024 * 1024);
  });

  it('reports a full disk and inability to remove a partial file instead of success', async () => {
    const { source, destination, copier } = setup();
    source.files.set('Film.mkv', new File(['movie'], 'Film.mkv'));
    const create = destination.getDirectoryHandle;
    destination.getDirectoryHandle = async (name, options) => {
      const target = await create(name, options);
      target.failWrite = true; target.failCleanup = true;
      return target;
    };
    const result = await copier.start([item('Film.mkv')], () => {});
    expect(result.copied).toBe(0); expect(result.failed).toBe(1);
    expect(result.items[0].error).toContain('Disk full');
    expect(result.items[0].error).toContain('odstrániť');
  });

  it('does not truncate a destination file that appears after preparation', async () => {
    const { source, destination, copier } = setup();
    source.files.set('Film.mkv', new File(['movie'], 'Film.mkv'));
    const result = await copier.start([item('Film.mkv')], snapshot => {
      if (snapshot.phase === 'copying' && snapshot.items[0].state === 'ready') {
        destination.directories.get(snapshot.target).files.set('Film.mkv', new File(['preserve'], 'Film.mkv'));
      }
    });
    expect(result.copied).toBe(0); expect(result.failed).toBe(1);
    expect(await destination.directories.get(result.target).files.get('Film.mkv').text()).toBe('preserve');
  });

  it('skips duplicate portable destination names', async () => {
    const { source, copier } = setup();
    source.files.set('Film.mkv', new File(['movie'], 'Film.mkv'));
    const result = await copier.start([item('Film.mkv'), item('Film.mkv')], () => {});
    expect(result.copied).toBe(1); expect(result.skipped).toBe(1);
  });

  it('throttles scan and chunk snapshots but forces phases, first bytes and completion', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { source, copier } = setup();
    const updates = [];
    const missing = Array.from({ length: 200 }, (_, i) => item('Missing-' + i + '.mkv'));
    source.files.set('Film.mkv', new File([new Uint8Array(12 * 1024 * 1024)], 'Film.mkv'));
    const result = await copier.start([...missing, item('Film.mkv')], snapshot => updates.push(snapshot));
    expect(updates.filter(snapshot => snapshot.phase === 'scanning')).toHaveLength(1);
    expect(updates.map(snapshot => snapshot.transferredBytes)).toContain(4 * 1024 * 1024);
    expect(updates.map(snapshot => snapshot.transferredBytes)).not.toContain(8 * 1024 * 1024);
    expect(updates.at(-1).phase).toBe('done');
    expect(result.transferredBytes).toBe(12 * 1024 * 1024);
    expect(result.failed).toBe(200); expect(result.copied).toBe(1);
    expect(copier.status().items[200].file).toBeUndefined();
  });
});
