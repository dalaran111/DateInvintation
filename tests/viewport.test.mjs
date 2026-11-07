import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveViewport, effectBudget } from '../src/viewport-utils.mjs';

const proMax = { width: 430, layoutHeight: 932, visualHeight: 932, focused: false, previousWidth: 430, previousHeight: 932, wasKeyboardOpen: false };

test('iPhone 15 Pro Max keeps the meeting scene in place when its keyboard opens', () => {
  const viewport = resolveViewport({ ...proMax, focused: true, visualHeight: 510 });
  assert.equal(viewport.height, 932);
  assert.equal(viewport.keyboardOpen, true);
  assert.equal(viewport.keyboardInset, 422);
  assert.equal(Math.round((3 * proMax.previousHeight) / viewport.height), 3);
});

test('iPhone 12 Pro does not shrink the deck even if innerHeight also changes', () => {
  const input = { width: 390, layoutHeight: 355, visualHeight: 355, focused: true, previousWidth: 390, previousHeight: 664, wasKeyboardOpen: false };
  const open = resolveViewport(input);
  assert.equal(open.height, 664);
  assert.equal(open.keyboardOpen, true);
  const closing = resolveViewport({ ...input, focused: false, wasKeyboardOpen: true });
  assert.equal(closing.height, 664);
  assert.equal(closing.keyboardOpen, true);
  const closed = resolveViewport({ ...input, layoutHeight: 664, visualHeight: 664, focused: false, wasKeyboardOpen: true });
  assert.equal(closed.height, 664);
  assert.equal(closed.keyboardOpen, false);
  assert.equal(closed.keyboardInset, 0);
});

test('a panned visual viewport reserves only the actual keyboard-covered area', () => {
  const viewport = resolveViewport({ ...proMax, focused: true, visualHeight: 510, visualTop: 35 });
  assert.equal(viewport.height, 932);
  assert.equal(viewport.keyboardInset, 387);
});

test('orientation and browser-bar changes may resize scenes without being mistaken for a keyboard', () => {
  const rotated = resolveViewport({ ...proMax, width: 932, layoutHeight: 430, visualHeight: 430, focused: true });
  assert.equal(rotated.rotated, true);
  assert.equal(rotated.height, 430);
  assert.equal(rotated.keyboardOpen, false);
  const bars = resolveViewport({ ...proMax, layoutHeight: 850, visualHeight: 850 });
  assert.equal(bars.height, 850);
  assert.equal(bars.keyboardOpen, false);
});

test('pinch zoom is not treated as an open keyboard', () => {
  const viewport = resolveViewport({ ...proMax, visualHeight: 460, scale: 2 });
  assert.equal(viewport.keyboardOpen, false);
  assert.equal(viewport.height, 932);
});

test('phones retain desktop effect quality and support ProMotion frame pacing', () => {
  for (const width of [390, 430]) {
    const budget = effectBudget(width);
    const desktop = effectBudget(1440);
    for (const key of ['cloudRatio', 'rippleRatio', 'flameRatio', 'cloudQuality', 'cloudFps', 'flameFps', 'rippleFps']) {
      assert.equal(budget[key], desktop[key]);
    }
    assert.equal(budget.cloudFps, 120);
  }
});
