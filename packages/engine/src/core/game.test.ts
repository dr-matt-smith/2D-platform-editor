import { assertEquals } from '@std/assert';
import { frameDt } from './game.ts';

Deno.test('frameDt: a normal 60 fps frame is its elapsed time in seconds', () => {
  assertEquals(frameDt(1016, 1000), 0.016);
});

Deno.test('frameDt: long stalls are capped at 1/30 s so physics cannot tunnel', () => {
  assertEquals(frameDt(5000, 1000), 1 / 30);
});

Deno.test('frameDt: a timestamp earlier than the last one never runs physics backwards', () => {
  // The first requestAnimationFrame timestamp can precede the
  // performance.now() taken when the loop starts.
  assertEquals(frameDt(995, 1000), 0);
});
