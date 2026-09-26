import { Key } from './Key.ts';
import type { InputSource } from './InputSource.ts';
import type { KeyName } from './Key.ts';

// Keyboard input from the browser window. Tracks two sets:
//   - held:    keys down right now (for running);
//   - pressed: keys that went down this frame (for jumping), cleared by
//              the game loop calling `endFrame()`.
// Key names are normalised (arrows become 'left'/'right'/'up'/'down',
// Space becomes 'space', characters are lower-cased), so the game reads
// `isDown(Key.Left)` rather than raw `KeyboardEvent.key` strings.
//
// Adapted from simple-platformer-1 (CC BY 4.0) — see ../LICENSE. Added
// here: `dispose()` removes the window listeners (the editor opens and
// closes playtests repeatedly), and losing window focus releases every
// held key (its keyup would never arrive, so the player would keep
// running on its own).
export class KeyboardInput implements InputSource {
  private readonly held = new Set<KeyName>();
  private readonly pressed = new Set<KeyName>();

  // Start listening to the window's keyboard. Call `dispose()` to stop.
  static attach(): KeyboardInput {
    const input = new KeyboardInput();
    window.addEventListener('keydown', input.onKeyDown);
    window.addEventListener('keyup', input.onKeyUp);
    window.addEventListener('blur', input.onBlur);
    return input;
  }

  private constructor() {}

  isDown(key: KeyName): boolean {
    return this.held.has(key);
  }

  wasPressed(key: KeyName): boolean {
    return this.pressed.has(key);
  }

  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  // The handlers are arrow-function fields, not methods, so each keeps
  // `this` and is the same function object for add and remove.
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const k = KeyboardInput.normalise(e.key);
    if (!k) return;
    if (!this.held.has(k)) this.pressed.add(k);
    this.held.add(k);
    // Stop space and the arrows scrolling the page.
    if (k === Key.Space || k === Key.Up || k === Key.Down || k === Key.Left || k === Key.Right) {
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const k = KeyboardInput.normalise(e.key);
    if (k) this.held.delete(k);
  };

  // A key released while the window is unfocused never sends keyup here,
  // so forget everything held when focus leaves; the player just stops.
  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  // A `KeyboardEvent.key` as a key name, or null for keys the game ignores.
  private static normalise(k: string): KeyName | null {
    if (k === ' ') return Key.Space;
    if (k === 'ArrowLeft') return Key.Left;
    if (k === 'ArrowRight') return Key.Right;
    if (k === 'ArrowUp') return Key.Up;
    if (k === 'ArrowDown') return Key.Down;
    if (k.length === 1) return k.toLowerCase();
    return null;
  }
}
