import { assert, assertEquals } from '@std/assert';
import { Key } from './Key.ts';
import { KeyboardInput } from './KeyboardInput.ts';

// `KeyboardInput` listens on `window`, which Deno doesn't have: stand in a plain
// EventTarget and dispatch key events shaped like the browser's.
function withFakeWindow(run: (win: EventTarget) => void) {
  const g = globalThis as { window?: unknown };
  const saved = g.window;
  const win = new EventTarget();
  g.window = win;
  try {
    run(win);
  } finally {
    g.window = saved;
  }
}
const key = (type: string, k: string) =>
  Object.assign(new Event(type, { cancelable: true }), { key: k });

Deno.test('held keys are released when the window loses focus', () => {
  withFakeWindow((win) => {
    const input = KeyboardInput.attach();
    win.dispatchEvent(key('keydown', 'ArrowRight'));
    assert(input.isDown(Key.Right));
    assert(input.wasPressed(Key.Right));

    // The keyup happens in another window, so only a blur arrives here.
    win.dispatchEvent(new Event('blur'));
    assertEquals(input.isDown(Key.Right), false);
    assertEquals(input.wasPressed(Key.Right), false);

    // Pressing again after focus returns works as normal.
    win.dispatchEvent(key('keydown', 'ArrowRight'));
    assert(input.isDown(Key.Right));
    input.dispose();
  });
});

Deno.test('dispose detaches every window listener, including blur', () => {
  withFakeWindow((win) => {
    const input = KeyboardInput.attach();
    win.dispatchEvent(key('keydown', ' '));
    input.dispose();
    win.dispatchEvent(new Event('blur'));
    win.dispatchEvent(key('keyup', ' '));
    assert(input.isDown(Key.Space)); // listeners gone: state no longer changes
  });
});
