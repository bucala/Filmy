import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const worker = readFileSync(resolve(root, 'sw.js'), 'utf8');
const shell = runInNewContext(worker + '\nSHELL;', { self: { addEventListener() {} } });

describe('offline application shell', () => {
  it('includes every relative ES module dependency reachable from the entry point', () => {
    const visited = new Set();
    function check(file) {
      if (visited.has(file)) return;
      visited.add(file);
      const asset = './' + relative(root, file).replace(/\\/g, '/');
      expect(shell, 'Missing offline module: ' + asset).toContain(asset);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/^\s*import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
        if (match[1].startsWith('.')) check(resolve(dirname(file), match[1]));
      }
    }
    check(resolve(root, 'src/main.js'));
    expect(visited.size).toBeGreaterThan(20);
  });
});
