import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from './history.js';

test('push / undo / redo step through states in order', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.push('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null); // nothing before the first state
  assert.equal(h.redo(), 'b');
  assert.equal(h.redo(), 'c');
  assert.equal(h.redo(), null);
});

test('a new push discards the redo branch', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.push('c');
  h.undo(); // → b
  h.push('d');
  assert.equal(h.redo(), null); // c is gone
  assert.equal(h.undo(), 'b'); // a, b, d
});

test('consecutive identical pushes are a no-op', () => {
  const h = createHistory();
  h.push('a');
  h.push('a');
  assert.equal(h.size, 1);
  assert.equal(h.canUndo, false);
});

test('the stack is capped, evicting the oldest', () => {
  const h = createHistory({ limit: 3 });
  for (const s of ['1', '2', '3', '4', '5']) h.push(s);
  assert.equal(h.size, 3); // 3,4,5
  assert.equal(h.undo(), '4');
  assert.equal(h.undo(), '3');
  assert.equal(h.undo(), null); // 1,2 evicted
});

test('undo(current) commits a pending live edit first', () => {
  const h = createHistory();
  h.push('a');
  assert.equal(h.undo('b'), 'a'); // 'b' committed, then step back
  assert.equal(h.redo(), 'b');
});

test('reset clears history to a single baseline', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.reset('z');
  assert.equal(h.size, 1);
  assert.equal(h.canUndo, false);
  assert.equal(h.undo(), null);
});

test('canUndo / canRedo reflect position', () => {
  const h = createHistory();
  assert.equal(h.canUndo, false);
  h.push('a');
  h.push('b');
  assert.equal(h.canUndo, true);
  assert.equal(h.canRedo, false);
  h.undo();
  assert.equal(h.canRedo, true);
});
