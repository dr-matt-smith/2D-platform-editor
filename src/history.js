// Whole-buffer undo/redo. Snapshots are full level-text strings; a new push
// drops the redo branch; the stack is capped so large/long sessions stay
// bounded (design v4 §7). Pure data structure — no DOM, unit-tested headless.

export function createHistory({ limit = 100 } = {}) {
  let states = [];
  let idx = -1; // points at the current committed state

  function push(s) {
    if (idx >= 0 && states[idx] === s) return; // ignore no-op repeats
    states = states.slice(0, idx + 1); // discard the redo branch
    states.push(s);
    if (states.length > limit) states.shift();
    idx = states.length - 1;
  }

  function reset(s) {
    states = [];
    idx = -1;
    if (s !== undefined) push(s);
  }

  // `current` is the live buffer: if it has uncommitted edits, commit them
  // first so Ctrl+Z always steps back from what the user sees.
  function undo(current) {
    if (current !== undefined && !(idx >= 0 && states[idx] === current)) {
      push(current);
    }
    if (idx <= 0) return null;
    idx -= 1;
    return states[idx];
  }

  function redo() {
    if (idx >= states.length - 1) return null;
    idx += 1;
    return states[idx];
  }

  return {
    push,
    reset,
    undo,
    redo,
    get canUndo() {
      return idx > 0;
    },
    get canRedo() {
      return idx < states.length - 1;
    },
    get size() {
      return states.length;
    },
  };
}
