import type { Sound } from './Sound.ts';

// Options for one playback.
export interface PlayOptions {
  // Multiplier on the sound's own loudness (default 1).
  volume?: number;
}

// Something that can play the game's sound effects. `SoundBank` plays them
// through Web Audio; the headless physics adapter passes a silent one.
export interface SoundPlayer {
  play(sound: Sound, options?: PlayOptions): void;
}
