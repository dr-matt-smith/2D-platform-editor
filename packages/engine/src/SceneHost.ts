import type { InputSource } from './InputSource.ts';
import type { SoundPlayer } from './SoundPlayer.ts';

// What a `Scene` needs from the game that hosts it. `Game` implements it
// for a real canvas; the headless physics adapter passes a plain object,
// so a scene can run without a canvas or an animation loop.
//
// `input` is writable: the agent swaps in a new `ScriptedInput` for each
// simulated action.
export interface SceneHost {
  input: InputSource;
  readonly sounds: SoundPlayer;
}
