// Filesystem access is confined to roots explicitly picked in a native dialog.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const VIDEO = /\.(mkv|mp4|avi|m4v|mov|wmv|ts|webm|mpg|mpeg|m2ts|vob|iso)$/i;
const busy = phase => ['scanning', 'copying', 'cancelling'].includes(phase);
function validName(name) {
  return typeof name === 'string' && name.length <= 240 && VIDEO.test(name) &&
    !/[\\/:*?"<>|]/.test(name) && !Array.from(name).some(c => c.charCodeAt(0) < 32) && !/[. ]$/.test(name) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name);
}
function within(root, file) {
  const relative = path.relative(root, file);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function validCandidate(relative) {
  return typeof relative === 'string' && relative.length <= 4096 &&
    relative.split('/').every(p => p && p !== '.' && p !== '..' && !/[\\:]/.test(p) &&
      !Array.from(p).some(c => c.charCodeAt(0) < 32));
}
async function resolveFile(root, item) {
  for (const relative of item.candidates.slice(0, 32)) {
    if (!validCandidate(relative) || relative.split('/').pop() !== item.name) continue;
    const candidate = path.join(root, ...relative.split('/'));
    try {
      const real = await fs.realpath(candidate);
      if (!within(root, real)) throw new Error('Súbor smeruje mimo zvolený zdroj.');
      const stat = await fs.stat(real);
      if (stat.isFile()) return { real, bytes: stat.size };
    } catch (e) {
      if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e;
    }
  }
  throw new Error('Súbor sa v zvolenom zdroji nenašiel.');
}

function createCopyEngine(onProgress = () => {}) {
  let source = null, destination = null, job = null, cancelled = false, completion = null;
  let lastEmit = 0;
  function snapshot() {
    if (!job) return { phase: 'idle', source, destination };
    return { ...job, elapsedMs: (job.finished || performance.now()) - job.started,
      source, destination, items: job.items.map(item => ({
        id: item.id, title: item.title, name: item.name, bytes: item.bytes, state: item.state, error: item.error
      })) };
  }
  function emit(force = false) {
    if (force || performance.now() - lastEmit >= 100) {
      lastEmit = performance.now(); onProgress(snapshot());
    }
  }
  async function run() {
    let target = null;
    try {
      const names = new Set();
      for (const item of job.items) {
        if (cancelled) break;
        try {
          if (!validName(item.name) || names.has(item.name.toLowerCase())) {
            item.state = 'skipped'; item.error = 'Neplatný alebo opakovaný názov.'; job.skipped++; continue;
          }
          const file = await resolveFile(source, item);
          names.add(item.name.toLowerCase());
          Object.assign(item, file, { state: 'ready' }); job.totalBytes += item.bytes;
        } catch (e) { item.state = 'error'; item.error = e.message; job.failed++; }
        emit();
      }
      if (!cancelled && job.items.some(item => item.state === 'ready')) {
        job.target = 'Filmy-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
        target = path.join(destination, job.target);
        await fs.mkdir(target); // Exclusive creation; never reuse an existing folder.
        job.phase = 'copying'; emit(true);
        const buffer = Buffer.alloc(4 * 1024 * 1024);
        for (const item of job.items) {
          if (cancelled) break;
          if (item.state !== 'ready') continue;
          let input = null, output = null, created = null;
          const dest = path.join(target, item.name);
          try {
            item.state = 'copying'; job.current = item.name; emit(true);
            if (await fs.realpath(item.real) !== item.real || !within(source, item.real)) {
              throw new Error('Zdroj sa počas prípravy presunul.');
            }
            if (await fs.realpath(target) !== target) throw new Error('Cieľový priečinok sa zmenil.');
            input = await fs.open(item.real, 'r');
            const stat = await input.stat();
            if (!stat.isFile() || stat.size !== item.bytes) throw new Error('Zdroj sa počas prípravy zmenil.');
            output = await fs.open(dest, 'wx');
            created = await output.stat();
            let offset = 0;
            while (offset < item.bytes) {
              if (cancelled) throw new Error('Zastavené.');
              const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, item.bytes - offset), offset);
              if (!bytesRead) throw new Error('Zdroj bol neočakávane skrátený.');
              let written = 0;
              while (written < bytesRead) {
                if (cancelled) throw new Error('Zastavené.');
                const result = await output.write(buffer, written, bytesRead - written, offset + written);
                if (!result.bytesWritten) throw new Error('Zápis sa zastavil.');
                written += result.bytesWritten; job.transferredBytes += result.bytesWritten;
                emit(job.transferredBytes === result.bytesWritten);
              }
              offset += bytesRead;
            }
            if (cancelled) throw new Error('Zastavené.');
            const { bytesRead: extra } = await input.read(buffer, 0, 1, offset);
            if (extra) throw new Error('Zdroj sa počas kopírovania zväčšil.');
            if ((await input.stat()).size !== item.bytes) throw new Error('Zdroj sa počas kopírovania zmenil.');
            if (cancelled) throw new Error('Zastavené.');
            await output.sync(); await output.close(); output = null;
            await input.close(); input = null;
            item.state = 'copied'; job.copied++;
          } catch (e) {
            if (output) try { await output.close(); } catch { /* Preserve the original transfer error. */ }
            if (input) try { await input.close(); } catch { /* Preserve the original transfer error. */ }
            // Delete only the exact incomplete file we created, never an
            // existing file or a replacement introduced by another process.
            if (created) {
              try {
                const current = await fs.lstat(dest);
                if (current.ino === created.ino && current.dev === created.dev) await fs.unlink(dest);
              } catch { item.error = 'Nedokončený súbor sa nepodarilo odstrániť.'; }
            }
            item.state = cancelled ? 'cancelled' : 'error'; item.error = item.error || e.message;
            if (!cancelled) job.failed++;
          }
          emit(true);
        }
      }
    } catch (e) { job.error = e.message; job.failed++; }
    finally {
      job.finished = performance.now();
      if (cancelled) job.items.forEach(item => {
        if (item.state === 'ready' || item.state === 'pending') item.state = 'cancelled';
      });
      job.phase = cancelled ? 'cancelled' : 'done'; job.current = ''; emit(true);
    }
    return snapshot();
  }
  return {
    async setRoot(role, root) {
      if (job && busy(job.phase)) throw new Error('Kopírovanie už prebieha.');
      const real = await fs.realpath(root);
      if (!(await fs.stat(real)).isDirectory()) throw new Error('Vyber priečinok.');
      if (role === 'source') source = real; else if (role === 'destination') destination = real;
      else throw new Error('Neplatný priečinok.');
      return { ok: true, name: real };
    },
    status: snapshot,
    cancel() { cancelled = true; if (job && busy(job.phase)) { job.phase = 'cancelling'; emit(true); } return snapshot(); },
    start(items) {
      if (job && busy(job.phase)) throw new Error('Kopírovanie už prebieha.');
      if (!source || !destination) throw new Error('Vyber zdrojový aj cieľový priečinok.');
      if (!Array.isArray(items) || !items.length || items.length > 2000 ||
          items.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' ||
            item.id.length > 100 || item.title.length > 300 ||
            !Array.isArray(item.candidates) || item.candidates.length > 32)) throw new Error('Neplatný výber filmov.');
      cancelled = false;
      job = { jobId: randomUUID(), phase: 'scanning', started: performance.now(), totalBytes: 0,
        transferredBytes: 0, copied: 0, skipped: 0, failed: 0,
        items: items.map(item => ({ id: item.id, title: item.title.slice(0, 300), name: item.name,
          candidates: item.candidates, bytes: 0, state: 'pending' })) };
      emit(true);
      completion = run();
      return snapshot();
    },
    wait() { return completion || Promise.resolve(snapshot()); }
  };
}

module.exports = { createCopyEngine, validName, validCandidate, within };
