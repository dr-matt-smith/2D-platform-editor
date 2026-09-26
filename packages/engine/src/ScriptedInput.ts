import type { InputSource } from './InputSource.ts';
import type { KeyName } from './Key.ts';
import type { RecordingEvent } from './RecordingEvent.ts';

// An input source that replays a recording instead of reading the
// keyboard. The agent's simulator and the editor's Demo mode both drive
// the ordinary `PlaytestScene` with one; the scene cannot tell it apart
// from `KeyboardInput`. An empty recording is a source with no key ever
// pressed.
//
// The recording is applied frame by frame through `advance(frame)`, which
// the scene calls before the player reads input.
export class ScriptedInput implements InputSource {
  // Sorted by frame; `cursor` is the index of the next unapplied event.
  private readonly events: readonly RecordingEvent[];
  private cursor = 0;
  private frame = -1;
  private readonly held = new Set<KeyName>();
  private readonly pressed = new Set<KeyName>();

  constructor(recording: readonly RecordingEvent[] = []) {
    // Copy, then sort, so the caller can reuse its array.
    this.events = [...recording].sort((a, b) => a.frame - b.frame);
  }

  // Apply every event with `frame` <= the given frame not applied yet.
  // Moving to a new frame first clears the just-pressed set (what the
  // keyboard's `endFrame` does). Frames are expected to increase;
  // advancing to the same frame again changes nothing.
  advance(frame: number): void {
    if (frame > this.frame) {
      this.pressed.clear();
      this.frame = frame;
    }
    while (this.cursor < this.events.length && this.events[this.cursor].frame <= frame) {
      const e = this.events[this.cursor++];
      if (e.down) {
        // A press only counts when the key was not already held.
        if (!this.held.has(e.key)) this.pressed.add(e.key);
        this.held.add(e.key);
      } else {
        this.held.delete(e.key);
      }
    }
  }

  isDown(key: KeyName): boolean {
    return this.held.has(key);
  }

  wasPressed(key: KeyName): boolean {
    return this.pressed.has(key);
  }

  // Nothing to do: `advance` clears the pressed set as each frame starts.
  endFrame(): void {}

  // Nothing to release: a recording holds no listeners.
  dispose(): void {}
}
