import { Sound } from './Sound.ts';
import type { PlayOptions, SoundPlayer } from './SoundPlayer.ts';

// One oscillator note of a synthesised sound (times in seconds).
export interface SynthNote {
  freq: number;
  start: number;
  dur: number;
  type: OscillatorType;
  peak: number;
}

// The window, as seen by a browser that may only have older Safari's
// prefixed AudioContext.
type AudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

// The game's sound effects, synthesised with Web Audio rather than loaded
// from files: each sound is a short list of oscillator notes with a gain
// envelope. No audio file is bundled — the recipe is the asset.
//
// Adapted from simple-platformer-1's `AssetLoader` (CC BY 4.0) — see
// ../LICENSE; the coin recipe is the upstream one. The sprite and level
// loaders were dropped (the shared renderer draws everything now), and
// `prewarm()` was added.
export class SoundBank implements SoundPlayer {
  // Each sound's notes, relative to the moment it starts.
  private static readonly RECIPES: Readonly<Record<Sound, readonly SynthNote[]>> = {
    [Sound.Coin]: [
      { freq: 880, start: 0, dur: 0.09, type: 'square', peak: 1 },
      { freq: 1320, start: 0.07, dur: 0.13, type: 'square', peak: 1 },
    ],
  };

  // Created on first use: browsers only allow audio after a user gesture.
  private audio: AudioContext | null = null;

  // The notes that make up `sound`.
  static notesOf(sound: Sound): readonly SynthNote[] {
    return SoundBank.RECIPES[sound];
  }

  // True once an AudioContext exists.
  get ready(): boolean {
    return this.audio !== null;
  }

  // Create (and resume) the AudioContext now. Call it from a user-gesture
  // handler such as the Play click: otherwise the context is created at
  // the first pickup, and that set-up puts the sound ~50 ms behind the
  // picture. Does nothing where Web Audio is unavailable.
  prewarm(): void {
    try {
      const Ctx = SoundBank.audioContextClass();
      if (Ctx && !this.audio) {
        this.audio = new Ctx();
        if (this.audio.state === 'suspended') this.audio.resume();
      }
    } catch { /* AudioContext unavailable — play() will do nothing */ }
  }

  play(sound: Sound, { volume = 1 }: PlayOptions = {}): void {
    const notes = SoundBank.RECIPES[sound];
    if (!notes) return;

    // By the time any sound plays the player has pressed a key, so a lazy
    // create-then-resume here satisfies browser autoplay rules.
    try {
      if (!this.audio) {
        const Ctx = SoundBank.audioContextClass();
        if (!Ctx) return;
        this.audio = new Ctx();
      }
      if (this.audio.state === 'suspended') this.audio.resume();
    } catch {
      return;
    }

    const ctx = this.audio;
    const now = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      const t1 = t0 + n.dur;
      const peak = n.peak * volume * 0.3; // headroom
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }

  // The browser's AudioContext class, if it has one. Throws where there
  // is no window at all; callers catch that.
  private static audioContextClass(): typeof AudioContext | undefined {
    const w = window as AudioWindow;
    return w.AudioContext || w.webkitAudioContext;
  }
}
