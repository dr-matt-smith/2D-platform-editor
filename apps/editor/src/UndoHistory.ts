// Whole-buffer undo/redo. Each state is the complete level text; a new
// push drops the redo branch; the stack is capped so a long session stays
// bounded. Pure data structure — no DOM — so it is unit-tested directly.
export class UndoHistory {
  static readonly DEFAULT_LIMIT = 100;

  private states: string[] = [];
  // Index of the current committed state (-1 when empty).
  private index = -1;

  constructor(private readonly limit: number = UndoHistory.DEFAULT_LIMIT) {}

  // Commit a state. Pushing the current state again is a no-op.
  push(state: string): void {
    if (this.index >= 0 && this.states[this.index] === state) return;
    this.states = this.states.slice(0, this.index + 1); // discard the redo branch
    this.states.push(state);
    if (this.states.length > this.limit) this.states.shift();
    this.index = this.states.length - 1;
  }

  // Start a fresh timeline, optionally from `state` (a newly loaded level).
  reset(state?: string): void {
    this.states = [];
    this.index = -1;
    if (state !== undefined) this.push(state);
  }

  // Step back. `current` is the live buffer: uncommitted edits are
  // committed first, so undo always steps back from what the user sees.
  // Returns null when there is nothing to undo.
  undo(current?: string): string | null {
    if (current !== undefined && !(this.index >= 0 && this.states[this.index] === current)) {
      this.push(current);
    }
    if (this.index <= 0) return null;
    this.index -= 1;
    return this.states[this.index];
  }

  // Step forward again; null when there is nothing to redo.
  redo(): string | null {
    if (this.index >= this.states.length - 1) return null;
    this.index += 1;
    return this.states[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.states.length - 1;
  }

  get size(): number {
    return this.states.length;
  }
}
