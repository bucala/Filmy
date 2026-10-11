import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trailerTarget, youtubeVideoId } from '../src/lib/trailer.js';

vi.mock('../src/state.js', () => ({ S: {} }));
import { S } from '../src/state.js';
import '../src/render.js';

const videoId = 'dQw4w9WgXcQ';
let frame, overlay, open;

beforeEach(() => {
  frame = { src: '' };
  overlay = { classList: { remove: vi.fn(), add: vi.fn() }, style: {} };
  open = vi.fn();
  vi.stubGlobal('window', { open, location: { href: '' } });
  vi.stubGlobal('document', { getElementById: id => id === 'trFrame' ? frame : overlay });
  Object.assign(S, {
    all: [{ id: 7, title: 'Film & ďalší', year: 2024, _yt: videoId }],
    liveCache: {}, _tvOn: false, _isAndroid: false,
    hasNativeAppBridge: () => false, nativeAppRequest: vi.fn().mockResolvedValue({ ok: true }), toast: vi.fn()
  });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('YouTube trailer targets', () => {
  it.each([
    videoId, 'https://youtu.be/' + videoId,
    'https://www.youtube.com/watch?v=' + videoId + '&t=20',
    'https://m.youtube.com/shorts/' + videoId,
    'https://www.youtube.com/embed/' + videoId
  ])('accepts an ID or a supported YouTube URL: %s', value => {
    expect(youtubeVideoId(value)).toBe(videoId);
  });

  it.each(['javascript:alert(1)', 'https://evil.example/watch?v=' + videoId, '<script>', null, {}, 'too-short'])(
    'rejects an arbitrary/invalid target: %s', value => {
      expect(youtubeVideoId(value)).toBeNull();
    });

  it('uses cached video metadata before falling back to a bounded search', () => {
    expect(trailerTarget({ title: 'Film', _yt: 'bad' }, { ytKey: videoId }).videoId).toBe(videoId);
    const target = trailerTarget({ title: 'A'.repeat(400) }, {});
    expect(target.videoId).toBe('');
    expect(target.query).toHaveLength(300);
    expect(target.url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
  });
});

describe('platform-specific trailer playback', () => {
  it('retains the embedded player on web/phone', () => {
    S.openTrailer(7);
    expect(frame.src).toBe('https://www.youtube.com/embed/' + videoId + '?autoplay=1');
    expect(overlay.classList.remove).toHaveBeenCalledWith('hidden');
  });

  it('opens the Android TV app through the native bridge, never an iframe', async () => {
    S._tvOn = true; S._isAndroid = true; S.hasNativeAppBridge = () => true;
    await S.openTrailer(7);
    expect(S.nativeAppRequest).toHaveBeenCalledWith('youtube', { videoId, query: 'Film & ďalší 2024 trailer' });
    expect(frame.src).toBe('');
    expect(overlay.classList.remove).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens YouTube search in the TV app when no trailer is known', async () => {
    S._tvOn = true; S.hasNativeAppBridge = () => true; delete S.all[0]._yt;
    await S.openTrailer(7);
    expect(S.nativeAppRequest).toHaveBeenCalledWith('youtube', { videoId: '', query: 'Film & ďalší 2024 trailer' });
  });

  it('uses the existing intent handler on older TV APKs', () => {
    S._tvOn = true; S._isAndroid = true;
    S.openTrailer(7);
    expect(globalThis.window.location.href).toBe('intent://www.youtube.com/watch?v=' + videoId +
      '#Intent;scheme=https;package=com.google.android.youtube.tv;end');
    expect(frame.src).toBe('');
  });

  it('opens a regular YouTube page on a non-Android TV browser', () => {
    S._tvOn = true;
    S.openTrailer(7);
    expect(open).toHaveBeenCalledWith('https://www.youtube.com/watch?v=' + videoId, '_blank', 'noopener,noreferrer');
  });

  it('reports a native failure without switching the library to an iframe', async () => {
    S._tvOn = true; S.hasNativeAppBridge = () => true;
    S.nativeAppRequest.mockRejectedValue(new Error('Unavailable'));
    await S.openTrailer(7);
    expect(S.toast).toHaveBeenCalledOnce();
    expect(frame.src).toBe('');
  });
});
