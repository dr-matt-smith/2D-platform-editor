import { assertEquals } from '@std/assert';
import { createHistory } from './history.ts';

Deno.test('push / undo / redo step through states in order', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.push('c');
  assertEquals(h.undo(), 'b');
  assertEquals(h.undo(), 'a');
  assertEquals(h.undo(), null); // nothing before the first state
  assertEquals(h.redo(), 'b');
  assertEquals(h.redo(), 'c');
  assertEquals(h.redo(), null);
});

Deno.test('a new push discards the redo branch', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.push('c');
  h.undo(); // → b
  h.push('d');
  assertEquals(h.redo(), null); // c is gone
  assertEquals(h.undo(), 'b'); // a, b, d
});

Deno.test('consecutive identical pushes are a no-op', () => {
  const h = createHistory();
  h.push('a');
  h.push('a');
  assertEquals(h.size, 1);
  assertEquals(h.canUndo, false);
});

Deno.test('the stack is capped, evicting the oldest', () => {
  const h = createHistory({ limit: 3 });
  for (const s of ['1', '2', '3', '4', '5']) h.push(s);
  assertEquals(h.size, 3); // 3,4,5
  assertEquals(h.undo(), '4');
  assertEquals(h.undo(), '3');
  assertEquals(h.undo(), null); // 1,2 evicted
});

Deno.test('undo(current) commits a pending live edit first', () => {
  const h = createHistory();
  h.push('a');
  assertEquals(h.undo('b'), 'a'); // 'b' committed, then step back
  assertEquals(h.redo(), 'b');
});

Deno.test('reset clears history to a single baseline', () => {
  const h = createHistory();
  h.push('a');
  h.push('b');
  h.reset('z');
  assertEquals(h.size, 1);
  assertEquals(h.canUndo, false);
  assertEquals(h.undo(), null);
});

Deno.test('canUndo / canRedo reflect position', () => {
  const h = createHistory();
  assertEquals(h.canUndo, false);
  h.push('a');
  h.push('b');
  assertEquals(h.canUndo, true);
  assertEquals(h.canRedo, false);
  h.undo();
  assertEquals(h.canRedo, true);
});
