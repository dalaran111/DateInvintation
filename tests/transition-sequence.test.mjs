import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransitionSequence } from '../src/transition-sequence.mjs';

test('navigation waits for the ripple completion signal', async () => {
  const events = [];
  let complete;
  const wave = new Promise((resolve) => { complete = resolve; });
  const sequence = createTransitionSequence((busy) => events.push(busy ? 'locked' : 'unlocked'));
  const pending = sequence.run(() => wave, () => events.push('navigate'));
  await Promise.resolve();
  assert.deepEqual(events, ['locked']);
  complete();
  assert.equal(await pending, true);
  assert.deepEqual(events, ['locked', 'navigate', 'unlocked']);
});

test('repeated taps cannot start another wave or interrupt the scene transition', async () => {
  let finishNavigation;
  const navigation = new Promise((resolve) => { finishNavigation = resolve; });
  let waves = 0;
  const sequence = createTransitionSequence(() => {});
  const first = sequence.run(async () => { waves++; }, () => navigation);
  await Promise.resolve();
  assert.equal(await sequence.run(async () => { waves++; }, () => {}), false);
  assert.equal(waves, 1);
  finishNavigation();
  assert.equal(await first, true);
  assert.equal(await sequence.run(async () => { waves++; }, () => {}), true);
  assert.equal(waves, 2);
});

test('unmounting cancels the deferred action', async () => {
  let finish;
  const wave = new Promise((resolve) => { finish = resolve; });
  const sequence = createTransitionSequence(() => {});
  let navigated = false;
  const pending = sequence.run(() => wave, () => { navigated = true; });
  sequence.cancel(); finish();
  assert.equal(await pending, false);
  assert.equal(navigated, false);
  assert.equal(await sequence.run(async () => {}, () => { navigated = true; }), false);
});

test('a failed effect releases the lock for the next attempt', async () => {
  const busy = [];
  const sequence = createTransitionSequence((value) => busy.push(value));
  await assert.rejects(sequence.run(async () => { throw new Error('context lost'); }, () => {}), /context lost/);
  assert.equal(await sequence.run(async () => {}, () => {}), true);
  assert.deepEqual(busy, [true, false, true, false]);
});
