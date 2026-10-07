import { COPY_LIMIT, copyBusy, copyFolderName, validCopyName } from './copy.js';

const CHUNK = 4 * 1024 * 1024;

async function resolveFile(root, item) {
  for (const relative of item.candidates || []) {
    if (typeof relative !== 'string' || relative.length > 4096 || relative.split('/').pop() !== item.name) continue;
    const parts = relative.split('/');
    if (parts.some(p => !p || p === '.' || p === '..' || /[\\:\u0000-\u001f]/.test(p))) continue;
    try {
      let dir = root;
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
      return await (await dir.getFileHandle(parts[parts.length - 1])).getFile();
    } catch (e) {
      if (e.name !== 'NotFoundError' && e.name !== 'TypeMismatchError') throw e;
    }
  }
  throw new Error('Súbor sa v zvolenom zdroji nenašiel.');
}

export function createWebCopier() {
  let source = null, destination = null, cancelled = false, job = null;
  let listener = () => {}, lastEmit = 0;
  const snapshot = () => job ? {
    ...job, elapsedMs: (job.finished || performance.now()) - job.started,
    items: job.items.map(item => ({ ...item, file: undefined }))
  } : {
      phase: 'idle', source: source && source.name, destination: destination && destination.name
    };
  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 100) return;
    lastEmit = now;
    listener(snapshot());
  };
  return {
    async pick(role) {
      if (job && copyBusy(job.phase)) throw new Error('Kopírovanie už prebieha.');
      const handle = await window.showDirectoryPicker({ mode: role === 'source' ? 'read' : 'readwrite' });
      if (role === 'source') source = handle; else destination = handle;
      return { ok: true, name: handle.name };
    },
    // Also usable with actual OPFS directory handles for deterministic,
    // permission-free integration checks. Handles stay only in memory.
    setRoots(src, dest) { source = src; destination = dest; },
    status: snapshot,
    cancel() { cancelled = true; if (job && copyBusy(job.phase)) { job.phase = 'cancelling'; emit(true); } },
    async start(items, onUpdate) {
      if (!source || !destination) throw new Error('Vyber zdrojový aj cieľový priečinok.');
      if (job && copyBusy(job.phase)) throw new Error('Kopírovanie už prebieha.');
      if (!items.length || items.length > COPY_LIMIT) throw new Error('Vyber 1 až ' + COPY_LIMIT + ' filmov.');
      listener = onUpdate;
      cancelled = false;
      job = { jobId: crypto.randomUUID(), phase: 'scanning', source: source.name, destination: destination.name,
        started: performance.now(), totalBytes: 0, transferredBytes: 0, copied: 0, skipped: 0, failed: 0,
        items: items.map(item => ({ ...item, state: 'pending', bytes: 0 })) };
      emit(true);
      let target = null;
      try {
        const names = new Set();
        for (const item of job.items) {
          if (cancelled) break;
          try {
            if (!validCopyName(item.name) || names.has(item.name.toLowerCase())) {
              item.state = 'skipped'; item.error = 'Neplatný alebo opakovaný názov.'; job.skipped++; continue;
            }
            item.file = await resolveFile(source, item);
            names.add(item.name.toLowerCase());
            item.bytes = item.file.size; item.state = 'ready'; job.totalBytes += item.bytes;
          } catch (e) { item.state = 'error'; item.error = e.message; job.failed++; }
          emit();
        }
        if (!cancelled && job.items.some(item => item.state === 'ready')) {
          job.target = copyFolderName();
          // Never open/truncate existing user files: use a fresh unpredictable
          // directory inside the user-picked destination, not the root itself.
          try { await destination.getDirectoryHandle(job.target); throw new Error('Cieľ už existuje. Spusti kopírovanie znovu.'); }
          catch (e) { if (e.name !== 'NotFoundError') throw e; }
          target = await destination.getDirectoryHandle(job.target, { create: true });
          job.phase = 'copying'; emit(true);
          for (const item of job.items) {
            if (cancelled) break;
            if (item.state !== 'ready') continue;
            let writer = null, created = false;
            try {
              item.state = 'copying'; job.current = item.name; emit(true);
              try {
                await target.getFileHandle(item.name);
                throw new Error('Cieľový súbor už existuje.');
              } catch (e) { if (e.name !== 'NotFoundError') throw e; }
              const handle = await target.getFileHandle(item.name, { create: true });
              created = true;
              writer = await handle.createWritable();
              for (let offset = 0; offset < item.file.size; offset += CHUNK) {
                if (cancelled) throw new DOMException('Zastavené.', 'AbortError');
                const chunk = await item.file.slice(offset, offset + CHUNK).arrayBuffer();
                await writer.write(chunk);
                job.transferredBytes += chunk.byteLength;
                emit(job.transferredBytes === chunk.byteLength);
              }
              if (cancelled) throw new DOMException('Zastavené.', 'AbortError');
              await writer.close(); writer = null;
              item.state = 'copied'; job.copied++;
            } catch (e) {
              if (writer) try { await writer.abort(); } catch {}
              item.state = cancelled ? 'cancelled' : 'error'; item.error = cancelled ? 'Zastavené.' : e.message;
              if (created) try { await target.removeEntry(item.name); }
              catch { item.error += ' Nedokončený súbor sa nepodarilo odstrániť.'; }
              if (!cancelled) job.failed++;
            }
            emit(true);
          }
        }
      } catch (e) { job.error = e.message; job.failed++; }
      finally {
        job.finished = performance.now();
        job.phase = cancelled ? 'cancelled' : 'done';
        job.current = '';
        job.items.forEach(item => {
          delete item.file;
          if (cancelled && (item.state === 'ready' || item.state === 'pending')) item.state = 'cancelled';
        });
        emit(true);
      }
      return snapshot();
    }
  };
}
