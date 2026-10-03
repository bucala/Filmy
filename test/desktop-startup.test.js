import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../desktop/main.js', import.meta.url), 'utf8');
const nodeRequire = createRequire(import.meta.url);

// Execute the entry point without starting Electron or loading native players.
// Record startup order: the rendering setting must precede app readiness.
function startup(platform) {
  const events = [];
  const app = {
    disableHardwareAcceleration: () => events.push('software-rendering'),
    requestSingleInstanceLock: () => true,
    on: () => {},
    whenReady: () => {
      events.push('ready');
      return { then: () => {} };
    }
  };
  runInNewContext(source, {
    require: (name) => {
      if (name === 'electron') return { app, protocol: { registerSchemesAsPrivileged: () => {} } };
      if (name === './players-win' || name === './embed-win') return {};
      return nodeRequire(name);
    },
    __dirname: '/desktop',
    process: { platform }
  });
  return events;
}

describe('desktop rendering startup', () => {
  it('selects software rendering on Windows before Electron is ready', () => {
    expect(startup('win32')).toEqual(['software-rendering', 'ready']);
  });

  it.each(['linux', 'darwin'])('preserves default rendering on %s', (platform) => {
    expect(startup(platform)).toEqual(['ready']);
  });
});
