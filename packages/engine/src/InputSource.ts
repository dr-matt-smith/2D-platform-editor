import type { KeyName } from './Key.ts';

// Where the game reads its keys from. The game loop and the player never
// know which implementation they have: `KeyboardInput` reads the real
// keyboard, `ScriptedInput` replays a recording.
export interface InputSource {
  // True for as long as the key is held down.
  isDown(key: KeyName): boolean;
  // True for exactly one frame after the key goes down.
  wasPressed(key: KeyName): boolean;
  // Called by the game loop at the end of every frame.
  endFrame(): void;
  // Release anything the source holds (e.g. window listeners).
  dispose(): void;
  // Scripted sources only: apply the recording up to `frame`. The playtest
  // scene calls it, when present, before the player reads input.
  advance?(frame: number): void;
}
