import { assertEquals } from '@std/assert';
import { Sound } from './Sound.ts';
import { SoundBank } from './SoundBank.ts';

Deno.test('the coin sound is the upstream rising two-note arpeggio', () => {
  const notes = SoundBank.notesOf(Sound.Coin);
  assertEquals(notes.map((n) => n.freq), [880, 1320]);
  assertEquals(notes.map((n) => n.type), ['square', 'square']);
});

Deno.test('without Web Audio, prewarm and play quietly do nothing', () => {
  // Deno has no AudioContext (nor a window).
  const sounds = new SoundBank();
  sounds.prewarm();
  sounds.play(Sound.Coin, { volume: 0.4 });
  assertEquals(sounds.ready, false);
});
