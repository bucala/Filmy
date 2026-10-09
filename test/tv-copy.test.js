import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { nearestInDirection } from '../src/lib/nav.js';

const source = readFileSync(new URL('../src/tv.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');

// DOM/geometry doubles verify scope boundaries. Real D-pad access is also
// checked in a separate isolated browser, without focusing the dock directly.
function setup() {
  const listeners = {}, elements = new Map(), document = {
    body: {}, activeElement: null,
    getElementById: id => elements.get(id),
    querySelectorAll: () => [],
    addEventListener: (name, listener) => { listeners[name] = listener; }
  };
  function element(id, x, y, parent, button = true) {
    const classes = new Set();
    const node = {
      id, parent, disabled: false, tagName: button ? 'BUTTON' : 'DIV', children: [],
      classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
      getClientRects: () => classes.has('hidden') || parent?.classList.contains('hidden') ? [] : [{}],
      getBoundingClientRect: () => ({ left: x, top: y, width: 40, height: 40 }),
      querySelectorAll: () => node.children, closest: () => null,
      focus: () => { document.activeElement = node; }, scrollIntoView: () => {}
    };
    elements.set(id, node);
    if (parent) parent.children.push(node);
    return node;
  }
  const main = element('mainSc', 0, 0, null), detail = element('detSc', 0, 0, null);
  const dock = element('copyDock', 0, 0, null), modal = element('copyOv', 0, 0, null);
  detail.classList.add('hidden'); modal.classList.add('hidden');
  const card = element('movie', 100, 100, main, false);
  const detailButton = element('detailButton', 100, 100, detail);
  const open = element('copyDockOpen', 100, 300, dock), exit = element('copyDockExit', 300, 300, dock);
  const close = element('copyClose', 100, 50, modal), start = element('copyStart', 100, 150, modal);
  const S = { _tvOn: true };
  runInNewContext(source, { S, nearestInDirection, document, window: { addEventListener: () => {} }, navigator: { userAgent: '' },
    setTimeout: () => 0, clearTimeout: () => {} });
  S.initTv();
  function press(key) {
    let prevented = false;
    listeners.keydown({ key, target: document.activeElement, preventDefault: () => { prevented = true; } });
    return prevented;
  }
  return { document, press, main, detail, dock, modal, card, detailButton, open, exit, close, start };
}

describe('TV copy dock navigation', () => {
  it('reaches the dock from a card and navigates within and back out of it', () => {
    const qa = setup();
    qa.card.focus(); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(qa.open);
    qa.press('ArrowRight');
    expect(qa.document.activeElement).toBe(qa.exit);
    qa.press('ArrowLeft'); qa.press('ArrowUp');
    expect(qa.document.activeElement).toBe(qa.card);
  });

  it('includes the dock while browsing detail, not the hidden movie screen', () => {
    const qa = setup();
    qa.main.classList.add('hidden'); qa.detail.classList.remove('hidden');
    qa.detailButton.focus(); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(qa.open);
    qa.press('ArrowUp');
    expect(qa.document.activeElement).toBe(qa.detailButton);
  });

  it('keeps a copy modal trapped even when the previously focused dock is visible', () => {
    const qa = setup();
    qa.open.focus(); qa.modal.classList.remove('hidden');
    qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(qa.close);
    qa.press('ArrowDown'); qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(qa.start);
  });

  it('excludes a hidden dock from the main scope', () => {
    const qa = setup();
    qa.dock.classList.add('hidden'); qa.card.focus();
    qa.press('ArrowDown');
    expect(qa.document.activeElement).toBe(qa.card);
  });
});
