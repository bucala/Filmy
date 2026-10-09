import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nearestInDirection } from '../src/lib/nav.js';

const source = readFileSync(new URL('../src/tv.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

// Exercise the actual TV event handlers with layout, focus and native-button
// defaults. Android's on-screen keyboard still needs a check on a real TV.
function setup(tv = true) {
  vi.useFakeTimers();
  const listeners = {}, windowListeners = {}, elements = new Map(), inputObservers = [];
  const document = {
    activeElement: null,
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => document.documentElement.querySelectorAll(selector),
    addEventListener: (name, listener) => { (listeners[name] ||= []).push(listener); },
    contains: node => {
      for (let current = node; current; current = current.parentElement) {
        if (current === document.documentElement) return true;
      }
      return false;
    },
    createElement: tag => make({ tag }, null)
  };
  const window = {
    __ANDROID_TV__: tv,
    addEventListener: (name, listener) => { (windowListeners[name] ||= []).push(listener); }
  };
  const S = {
    favs: new Set(), STAR_ON: '*', STAR_OFF: '*',
    playMovie: vi.fn(), togFav: vi.fn(), closeSett: vi.fn()
  };

  function matches(node, selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      const exclusions = [...part.matchAll(/:not\(([^)]+)\)/g)];
      if (exclusions.some(match => matches(node, match[1]))) return false;
      part = part.replace(/:not\([^)]+\)/g, '');
      const tag = part.match(/^[a-z]+/i);
      if (tag && node.tagName !== tag[0].toUpperCase()) return false;
      if ([...part.matchAll(/\.([\w-]+)/g)].some(match => !node.classList.contains(match[1]))) return false;
      return [...part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(match => {
        const value = node.getAttribute(match[1]);
        return match[2] === undefined ? value !== null : value === match[2];
      });
    });
  }

  function emit(name, data = {}) {
    const event = {
      defaultPrevented: false, stopped: false, ...data,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }
    };
    for (const listener of listeners[name] || []) {
      listener(event);
      if (event.stopped) break;
    }
    return event;
  }

  function make({ id = '', tag = 'DIV', x = 0, y = 0, width = 40, height = 40,
    classes = [], type = 'text', readOnly = false, attrs = {} } = {}, parent = document.body) {
    const classNames = new Set(classes), attributes = new Map(Object.entries(attrs)), localListeners = {};
    if (tag.toUpperCase() === 'INPUT') attributes.set('type', type);
    let html = '';
    const node = {
      get id() { return id; },
      set id(value) {
        if (id) elements.delete(id);
        id = String(value);
        if (id) elements.set(id, node);
      },
      tagName: tag.toUpperCase(), type, readOnly, disabled: false, dataset: {},
      children: [], parentElement: null, onclick: null, clicked: vi.fn(), submitted: vi.fn(),
      classList: {
        contains: name => classNames.has(name),
        add: (...names) => names.forEach(name => classNames.add(name)),
        remove: (...names) => names.forEach(name => classNames.delete(name))
      },
      get className() { return [...classNames].join(' '); },
      set className(value) { classNames.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classNames.add(name)); },
      getAttribute: name => name === 'id' ? id || null : attributes.get(name) ?? null,
      setAttribute: (name, value) => { attributes.set(name, String(value)); },
      removeAttribute: name => attributes.delete(name),
      hasAttribute: name => node.getAttribute(name) !== null,
      matches: selector => matches(node, selector),
      closest: selector => {
        for (let current = node; current; current = current.parentElement) {
          if (matches(current, selector)) return current;
        }
        return null;
      },
      getClientRects: () => {
        for (let current = node; current; current = current.parentElement) {
          if (current.classList.contains('hidden')) return [];
        }
        return [{}];
      },
      getBoundingClientRect: () => ({ left: x, top: y, width, height }),
      querySelectorAll: selector => node.children.flatMap(child => [
        ...(matches(child, selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]),
      querySelector: selector => node.querySelectorAll(selector)[0] || null,
      appendChild: child => {
        child.parentElement = node;
        node.children.push(child);
        inputObservers.forEach(callback => callback([{ addedNodes: [child] }]));
        return child;
      },
      focus: () => {
        if (document.activeElement === node) return;
        const previous = document.activeElement;
        document.activeElement = node;
        if (previous) emit('focusout', { target: previous });
        emit('focusin', { target: node });
      },
      blur: () => {
        if (document.activeElement !== node) return;
        document.activeElement = document.body;
        emit('focusout', { target: node });
      },
      scrollIntoView: () => {}, select: vi.fn(),
      addEventListener: (name, listener) => { (localListeners[name] ||= []).push(listener); },
      click: (detail = 0) => {
        const event = emit('click', { target: node, detail });
        if (!event.stopped && !event.defaultPrevented) {
          node.clicked();
          if (node.onclick) node.onclick(event);
          (localListeners.click || []).forEach(listener => listener(event));
        }
        return event;
      },
      get innerHTML() { return html; },
      set innerHTML(value) {
        html = value;
        node.children.forEach(child => { child.parentElement = null; });
        node.children = [];
        if (node.id === 'tvActOv') {
          make({ id: 'tvActPlay', tag: 'BUTTON', x: 440, y: 320, width: 140, height: 100 }, node);
          make({ id: 'tvActFav', tag: 'BUTTON', x: 620, y: 320, width: 140, height: 100 }, node);
        }
      }
    };
    if (attrs['data-id']) node.dataset.id = attrs['data-id'];
    if (id) elements.set(id, node);
    if (parent) parent.appendChild(node);
    return node;
  }

  document.documentElement = make({ tag: 'HTML' }, null);
  document.body = make({ tag: 'BODY' }, document.documentElement);
  document.activeElement = document.body;
  const main = make({ id: 'mainSc', width: 1100, height: 800 });
  const settings = make({ id: 'settPanel', classes: ['hidden'], width: 1100, height: 800 });
  const card = make({ id: 'movie', x: 100, y: 200, width: 140, height: 200,
    attrs: { 'data-id': '7', tabindex: '0', role: 'button' } }, main);
  const search = make({ id: 'srchInp', tag: 'INPUT', type: 'search', x: 100, y: 40, width: 500 }, main);
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(root, options) { if (options.childList) inputObservers.push(this.callback); }
  }
  runInNewContext(source, { S, nearestInDirection, document, window, MutationObserver,
    navigator: { userAgent: '' }, setTimeout, clearTimeout });
  S.initTv();

  function press(key, repeat = false, extra = {}) {
    const target = document.activeElement;
    const event = emit('keydown', { key, repeat, target, ...extra });
    // Enter activates real buttons on keydown unless a capture handler stops it.
    if (!event.defaultPrevented && key === 'Enter') {
      if (target.tagName === 'BUTTON') target.click();
      if (target.tagName === 'INPUT') target.submitted();
    }
    return event;
  }
  function release(key = 'Enter') { return emit('keyup', { key, target: document.activeElement }); }
  function openSettings() { settings.classList.remove('hidden'); }
  function blurWindow() { (windowListeners.blur || []).forEach(listener => listener()); }
  return { S, document, window, make, main, settings, card, search, press, release, openSettings, blurWindow };
}

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function ratingSettings(qa, active = 0) {
  qa.openSettings();
  const tabs = ['appearance', 'data', 'sync', 'playback', 'tools', 'admin'].map((id, i) =>
    qa.make({ id, tag: 'BUTTON', x: 100 + i * 85, y: 120, width: 75, classes: ['sett-tab'] }, qa.settings));
  const group = qa.make({ x: 100, y: 280, width: 900, height: 36, classes: ['sett-toggle'] }, qa.settings);
  const ratings = ['tmdb', 'imdb', 'csfd'].map((id, i) =>
    qa.make({ id, tag: 'BUTTON', x: 110 + i * 65, y: 280, width: 60, height: 36,
      classes: ['ttab', ...(i === active ? ['on'] : [])] }, group));
  const input = qa.make({ id: 'tmdbKeyInp', tag: 'INPUT', type: 'password', x: 100, y: 440,
    width: 820, height: 38 }, qa.settings);
  const save = qa.make({ id: 'tmdbSaveKey', tag: 'BUTTON', x: 930, y: 440, width: 70, height: 38 }, qa.settings);
  const load = qa.make({ id: 'settBtnBatch', tag: 'BUTTON', x: 100, y: 530, width: 900 }, qa.settings);
  return { tabs, ratings, input, save, load };
}

describe('TV settings navigation', () => {
  it('reaches every rating button in both directions despite the wide group', () => {
    const qa = setup(), settings = ratingSettings(qa);
    settings.ratings[0].focus();
    for (const target of settings.ratings.slice(1)) {
      qa.press('ArrowRight');
      expect(qa.document.activeElement).toBe(target);
    }
    for (const target of settings.ratings.slice(0, -1).reverse()) {
      qa.press('ArrowLeft');
      expect(qa.document.activeElement).toBe(target);
    }
  });

  it.each([0, 1, 2])('enters the selected rating vertically, including selection %i', active => {
    const qa = setup(), settings = ratingSettings(qa, active);
    settings.tabs[5].focus(); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(settings.ratings[active]);
    qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(settings.input);
    expect(settings.input.readOnly).toBe(true);
    qa.press('ArrowUp');
    expect(qa.document.activeElement).toBe(settings.ratings[active]);
  });

  it('moves from OK into the key field and back out without entering edit mode', () => {
    const qa = setup(), settings = ratingSettings(qa);
    settings.save.focus(); qa.press('ArrowLeft');
    expect(qa.document.activeElement).toBe(settings.input);
    expect(settings.input.readOnly).toBe(true);
    qa.press('ArrowRight');
    expect(qa.document.activeElement).toBe(settings.save);
    qa.press('ArrowLeft'); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(settings.load);
  });

  it('does not trap the remote on a closed select, but retains range adjustment', () => {
    const qa = setup();
    const select = qa.make({ tag: 'SELECT', x: 800, y: 200 }, qa.main);
    const range = qa.make({ tag: 'INPUT', type: 'range', x: 800, y: 300 }, qa.main);
    select.focus(); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(range);
    expect(qa.press('ArrowRight').defaultPrevented).toBe(false);
    expect(qa.document.activeElement).toBe(range);
    qa.press('ArrowUp');
    expect(qa.document.activeElement).toBe(select);
  });
});

describe('TV text field activation', () => {
  it('selects search without an IME and consumes the first OK until release', () => {
    const qa = setup();
    qa.window.__tvKey('guide');
    expect(qa.document.activeElement).toBe(qa.search);
    expect(qa.search.readOnly).toBe(true);
    expect(qa.search.getAttribute('inputmode')).toBe('none');
    expect(qa.press('Enter').stopped).toBe(true);
    expect(qa.search.readOnly).toBe(false);
    expect(qa.search.getAttribute('inputmode')).toBeNull();
    qa.press('Enter', true);
    expect(qa.search.submitted).not.toHaveBeenCalled();
    expect(qa.release().defaultPrevented).toBe(true);
    qa.press('Enter'); qa.release();
    expect(qa.search.submitted).toHaveBeenCalledTimes(1);
  });

  it('allows horizontal caret movement only while editing, then restores navigation', () => {
    const qa = setup(), settings = ratingSettings(qa);
    settings.input.focus(); qa.press('Enter'); qa.release();
    expect(qa.press('ArrowRight').defaultPrevented).toBe(false);
    expect(qa.document.activeElement).toBe(settings.input);
    expect(qa.press('Escape').stopped).toBe(true);
    expect(settings.input.readOnly).toBe(true);
    expect(qa.document.activeElement).toBe(settings.input);
    qa.press('ArrowRight');
    expect(qa.document.activeElement).toBe(settings.save);
    expect(qa.S.closeSett).not.toHaveBeenCalled();
  });

  it('activates a field with a mouse click and relocks it after leaving', () => {
    const qa = setup(), settings = ratingSettings(qa);
    settings.input.focus();
    settings.input.click(1);
    expect(settings.input.readOnly).toBe(false);
    qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(settings.load);
    expect(settings.input.readOnly).toBe(true);
    expect(settings.input.classList.contains('tv-input-idle')).toBe(true);
  });

  it('uses Back to end editing before closing a panel', () => {
    const qa = setup(), settings = ratingSettings(qa);
    settings.input.focus(); qa.press('Enter'); qa.release();
    expect(qa.window.__tvBack()).toBe(true);
    expect(settings.input.readOnly).toBe(true);
    expect(qa.S.closeSett).not.toHaveBeenCalled();
    expect(qa.window.__tvBack()).toBe(true);
    expect(qa.S.closeSett).toHaveBeenCalledTimes(1);
  });

  it('prepares dynamically inserted fields and restores their original input mode', () => {
    const qa = setup();
    const field = qa.make({ tag: 'INPUT', type: 'number', x: 800, y: 200, attrs: { inputmode: 'decimal' } }, qa.main);
    expect(field.readOnly).toBe(true);
    expect(field.getAttribute('inputmode')).toBe('none');
    field.focus(); qa.press('Enter'); qa.release();
    expect(field.getAttribute('inputmode')).toBe('decimal');
    qa.blurWindow();
    expect(field.readOnly).toBe(true);
    field.focus(); field.click(1);
    expect(field.getAttribute('inputmode')).toBe('decimal');
  });

  it('keeps all textarea arrows for editing and respects composition', () => {
    const qa = setup();
    const field = qa.make({ tag: 'TEXTAREA', x: 800, y: 200 }, qa.main);
    field.focus(); qa.press('Enter'); qa.release();
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      expect(qa.press(key).defaultPrevented).toBe(false);
      expect(qa.document.activeElement).toBe(field);
    }
    expect(qa.press('Enter', false, { isComposing: true, keyCode: 229 }).defaultPrevented).toBe(false);
    expect(field.readOnly).toBe(false);
  });

  it('does not unlock an inherently read-only field', () => {
    const qa = setup();
    const field = qa.make({ tag: 'INPUT', readOnly: true, attrs: { inputmode: 'numeric' } }, qa.main);
    field.focus(); qa.press('Enter'); qa.release(); field.click(1);
    expect(field.readOnly).toBe(true);
    expect(field.getAttribute('inputmode')).toBe('numeric');
    expect(field.classList.contains('tv-input-idle')).toBe(false);
  });

  it('leaves phone/desktop inputs alone and prepares them on late native TV detection', () => {
    const qa = setup(false);
    qa.search.focus();
    expect(qa.search.readOnly).toBe(false);
    expect(qa.press('ArrowRight').defaultPrevented).toBe(false);
    qa.window.__enableTvMode();
    expect(qa.search.readOnly).toBe(true);
    expect(qa.document.documentElement.classList.contains('tv')).toBe(true);
  });
});

describe('TV long-press actions', () => {
  it('opens a card once on a short press, not on keydown or repeat', () => {
    const qa = setup();
    qa.card.focus(); qa.press('Enter'); qa.press('Enter', true);
    expect(qa.card.clicked).not.toHaveBeenCalled();
    qa.release();
    expect(qa.card.clicked).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1600);
    expect(qa.document.getElementById('tvActOv')).toBeNull();
  });

  it('ignores held OK, synthesized clicks and release after opening the menu', () => {
    const qa = setup();
    qa.card.focus(); qa.press('Enter');
    vi.advanceTimersByTime(1550);
    const play = qa.document.getElementById('tvActPlay');
    expect(qa.document.activeElement).toBe(play);
    expect(qa.press('Enter', true).stopped).toBe(true);
    expect(qa.press('Enter', false).stopped).toBe(true); // Remotes without a repeat flag.
    expect(play.click().defaultPrevented).toBe(true);
    expect(qa.release().defaultPrevented).toBe(true);
    expect(qa.S.playMovie).not.toHaveBeenCalled();
    expect(qa.card.clicked).not.toHaveBeenCalled();
    expect(qa.document.getElementById('tvActOv').classList.contains('hidden')).toBe(false);
    qa.press('Enter'); qa.release();
    expect(qa.S.playMovie).toHaveBeenCalledWith(7);
    expect(qa.S.playMovie).toHaveBeenCalledTimes(1);
  });

  it('allows choosing the favorite action only with a fresh press', () => {
    const qa = setup();
    qa.card.focus(); qa.press('Enter'); vi.advanceTimersByTime(1550); qa.release();
    qa.press('ArrowRight');
    expect(qa.document.activeElement.id).toBe('tvActFav');
    qa.press('Enter'); qa.release();
    expect(qa.S.togFav).toHaveBeenCalledWith(7, null);
    expect(qa.S.playMovie).not.toHaveBeenCalled();
    expect(qa.document.activeElement).toBe(qa.card);
  });

  it('cancels a pending hold when focus or the window changes', () => {
    const qa = setup();
    qa.card.focus(); qa.press('Enter'); qa.search.focus();
    vi.advanceTimersByTime(1600); qa.release();
    expect(qa.document.getElementById('tvActOv')).toBeNull();
    expect(qa.card.clicked).not.toHaveBeenCalled();
    qa.card.focus(); qa.press('Enter'); qa.blurWindow();
    vi.advanceTimersByTime(1600); qa.release();
    expect(qa.document.getElementById('tvActOv')).toBeNull();
    expect(qa.card.clicked).not.toHaveBeenCalled();
  });

  it('does not refocus a menu closed before its focus timer fires', () => {
    const qa = setup();
    qa.card.focus(); qa.press('Enter'); vi.advanceTimersByTime(1500);
    expect(qa.window.__tvBack()).toBe(true);
    qa.release(); vi.advanceTimersByTime(50);
    expect(qa.document.activeElement).toBe(qa.card);
    expect(qa.S.playMovie).not.toHaveBeenCalled();
  });
});

describe('TV mouse and focus styles', () => {
  it('never hides the native cursor in TV mode', () => {
    expect(css).not.toMatch(/html\.tv[^{}]*\{[^}]*cursor\s*:\s*none/s);
  });

  it('keeps an explicit focus ring for selected, non-editing fields', () => {
    expect(css).toMatch(/html\.tv input\.tv-input-idle:focus[^{}]*\{[^}]*outline:2px solid var\(--primary\)/s);
  });
});
