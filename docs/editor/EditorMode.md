# EditorMode

`apps/editor/src/EditorMode.ts` · enum

What the editor is doing.

## Relationships
- owned by [PlayModeController](PlayModeController.md) (`mode`); read by [EditorApp](EditorApp.md)

## Members
| Member | Value | Meaning |
|---|---|---|
| `Edit` | `'edit'` | Editing; the preview repaints on every change |
| `Play` | `'play'` | Playtesting with the keyboard; the engine owns the canvas |
| `Demo` | `'demo'` | Replaying an agent solution; ends by itself |

## Example
```ts
if (playMode.mode === EditorMode.Play) return; // don't draw over the game
```

## Design notes
One enum instead of flags such as `isPlaying` and `isDemo`, which could
contradict each other.
