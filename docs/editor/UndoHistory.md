# UndoHistory

`apps/editor/src/UndoHistory.ts` · class

Whole-buffer undo and redo. Each state is the complete level text; pushing
a new state drops the redo branch; the stack keeps at most `limit` states.

## Relationships
- owned by [EditorApp](EditorApp.md): pushed on each pause in typing and each tool edit,
  reset when a level is opened, stepped by the [KeyboardShortcuts](KeyboardShortcuts.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_LIMIT` | static readonly | `100` |
| `new UndoHistory(limit?)` | constructor | |
| `push(state)` | method | Commit a state (a repeat of the current one is ignored) |
| `reset(state?)` | method | Start a new timeline |
| `undo(current?)` | method | Step back; commits `current` first if it has unsaved edits. Null at the start |
| `redo()` | method | Step forward; null at the end |
| `canUndo`, `canRedo`, `size` | get accessors | |

## Example
```ts
const history = new UndoHistory();
history.push('a');
history.push('b');
history.undo(); // 'a'
history.redo(); // 'b'
```

## Design notes
A classic encapsulated data structure: the array and index are private and
only change through the four operations, so the invariants (the index
points at the current state; the branch after it is the redo list) hold.
Storing whole snapshots is simple and, at level sizes, cheap.
