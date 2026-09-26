import { assertEquals } from '@std/assert';
import { Key } from './Key.ts';
import { ScriptedInput } from './ScriptedInput.ts';

Deno.test('an empty recording never holds or presses a key', () => {
  const input = new ScriptedInput();
  for (let f = 0; f < 5; f++) {
    input.advance(f);
    assertEquals(input.isDown(Key.Right), false);
    assertEquals(input.wasPressed(Key.Space), false);
  }
});

Deno.test('advance applies events up to the frame; a press lasts one frame', () => {
  const input = new ScriptedInput([
    { frame: 2, key: Key.Space, down: true },
    { frame: 4, key: Key.Space, down: false },
  ]);
  input.advance(1);
  assertEquals(input.isDown(Key.Space), false);
  input.advance(2);
  assertEquals([input.isDown(Key.Space), input.wasPressed(Key.Space)], [true, true]);
  input.advance(3);
  assertEquals([input.isDown(Key.Space), input.wasPressed(Key.Space)], [true, false]);
  input.advance(4);
  assertEquals(input.isDown(Key.Space), false);
});

Deno.test('advancing to the same frame again changes nothing', () => {
  const input = new ScriptedInput([{ frame: 0, key: Key.Up, down: true }]);
  input.advance(0);
  input.advance(0);
  assertEquals(input.wasPressed(Key.Up), true);
});

Deno.test('a skipped-over frame range is applied in one advance', () => {
  const input = new ScriptedInput([
    { frame: 1, key: Key.Left, down: true },
    { frame: 3, key: Key.Right, down: true },
  ]);
  input.advance(5);
  assertEquals([input.isDown(Key.Left), input.isDown(Key.Right)], [true, true]);
});

Deno.test('the recording is copied and sorted, so the caller\'s array is untouched', () => {
  const recording = [
    { frame: 3, key: Key.Right, down: false },
    { frame: 0, key: Key.Right, down: true },
  ];
  const input = new ScriptedInput(recording);
  assertEquals(recording[0].frame, 3);
  input.advance(0);
  assertEquals(input.isDown(Key.Right), true);
  input.advance(3);
  assertEquals(input.isDown(Key.Right), false);
});

Deno.test('endFrame and dispose are no-ops', () => {
  const input = new ScriptedInput([{ frame: 0, key: Key.Space, down: true }]);
  input.advance(0);
  input.endFrame();
  input.dispose();
  assertEquals(input.wasPressed(Key.Space), true);
});
