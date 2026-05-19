/**
 * Loads and stores game media. Sprites are HTMLImageElements keyed by
 * short names ("player", "coin", ...). Levels are raw text files keyed by
 * name ("level1", ...), parsed later by the scene that needs them.
 *
 * Sound effects are *synthesised* at runtime with the Web Audio API
 * rather than loaded from files — this keeps the project fully original
 * (no third-party audio licence) and 100% offline. Each effect is a
 * short oscillator + gain-envelope recipe in `synth()`; `play(name)`
 * keeps the same call signature scenes used for the old sample player.
 *
 * Usage: build one in main.js, await `Promise.all([loadSprite(...), ...])`,
 * then hand the instance to Game.
 */
export class AssetLoader {
  constructor() {
    this.sprites = {};
    this.levels  = {};
    this.audio   = null; // lazily created AudioContext (needs a user gesture)
  }

  loadSprite(name, url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload  = () => { this.sprites[name] = img; res(img); };
      img.onerror = () => rej(new Error(`failed to load sprite ${name} from ${url}`));
      img.src = url;
    });
  }

  loadLevel(name, url) {
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`failed to load level ${name}: HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => { this.levels[name] = text; return text; });
  }

  sprite(name) { return this.sprites[name]; }
  level(name)  { return this.levels[name]; }

  /**
   * Synthesised sound effects, keyed by name. Each returns an array of
   * { freq, start, dur, type, peak } notes (times in seconds, relative
   * to playback start). "coin" is a short rising two-tone arpeggio.
   */
  synth(name) {
    const recipes = {
      coin: [
        { freq: 880,  start: 0,    dur: 0.09, type: "square", peak: 1 },
        { freq: 1320, start: 0.07, dur: 0.13, type: "square", peak: 1 },
      ],
    };
    return recipes[name];
  }

  play(name, { volume = 1 } = {}) {
    const notes = this.synth(name);
    if (!notes) return;

    // AudioContext must be created/resumed after a user gesture; by the
    // time any sfx fires the player has already pressed a key, so a lazy
    // create-then-resume here satisfies browser autoplay policies.
    try {
      if (!this.audio) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.audio = new Ctx();
      }
      if (this.audio.state === "suspended") this.audio.resume();
    } catch { return; }

    const ctx = this.audio;
    const now = ctx.currentTime;
    for (const n of notes) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      const t1 = t0 + n.dur;
      const peak = n.peak * volume * 0.3; // headroom; matches old 0.4 feel
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }
}
