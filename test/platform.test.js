import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/state.js', () => ({ S: {} }));
import { S } from '../src/state.js';
import '../src/platform.js';

let bridge, requests;
beforeEach(() => {
  vi.useFakeTimers();
  requests = [];
  bridge = { postMessage: vi.fn(value => requests.push(JSON.parse(value))) };
  vi.stubGlobal('window', { FilmyApp: bridge });
  vi.stubGlobal('crypto', { randomUUID: () => 'request-1' });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function reply(result) { bridge.onmessage({ data: JSON.stringify({ id: requests[0].id, result }) }); }

describe('native application bridge', () => {
  it('correlates replies and ignores malformed or unrelated messages', async () => {
    const promise = S.nativeAppRequest('youtube', { videoId: 'dQw4w9WgXcQ' });
    bridge.onmessage({ data: '{bad' });
    for (const data of ['null', '[]', '"text"', '7']) bridge.onmessage({ data });
    bridge.onmessage({ data: '{"id":"other","result":{"ok":true}}' });
    reply({ ok: true });
    await expect(promise).resolves.toEqual({ ok: true });
    expect(requests[0]).toEqual({ id: 'request-1', action: 'youtube', videoId: 'dQw4w9WgXcQ' });
  });

  it('treats cancellation as cancellation, not success or a transport failure', async () => {
    const promise = S.nativeAppRequest('loadSettings');
    reply({ ok: false, cancelled: true });
    await expect(promise).resolves.toEqual({ ok: false, cancelled: true });
  });

  it('does not time out a document picker while the user chooses a file', async () => {
    const promise = S.nativeAppRequest('saveSettings');
    vi.advanceTimersByTime(600000);
    reply({ ok: true });
    await expect(promise).resolves.toEqual({ ok: true });
  });
  it.each([{}, [], { ok: 'true' }, { ok: true, cancelled: true }, { ok: false, cancelled: 'yes' }])(
    'rejects an invalid correlated result instead of claiming success', async result => {
      const promise = S.nativeAppRequest('saveSettings');
      reply(result);
      await expect(promise).rejects.toThrow('neplatnú odpoveď');
    }
  );

  it('rejects explicit native failures and a missing bridge', async () => {
    const promise = S.nativeAppRequest('youtube');
    reply({ ok: false, error: 'Unavailable' });
    await expect(promise).rejects.toThrow('Unavailable');
    delete globalThis.window.FilmyApp;
    await expect(S.nativeAppRequest('youtube')).rejects.toThrow('APK');
  });

  it('bounds a YouTube launch and handles a failed send', async () => {
    const promise = S.nativeAppRequest('youtube');
    const assertion = expect(promise).rejects.toThrow('YouTube');
    vi.advanceTimersByTime(15000);
    await assertion;
    bridge.postMessage.mockImplementation(() => { throw new Error('Transport'); });
    await expect(S.nativeAppRequest('loadSettings')).rejects.toThrow('Androidu');
  });
});
