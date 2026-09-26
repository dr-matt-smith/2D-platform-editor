# PlayModeHost

`apps/editor/src/PlayModeController.ts` · interface

What [PlayModeController](PlayModeController.md) needs from the rest of the editor.

## Relationships
- passed to [PlayModeController](PlayModeController.md); implemented by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `text()` | method | The live level text (unsaved edits included) |
| `issues(level)` | method | The level's issues as the problems bar shows them |
| `repaint()` | method | Redraw the editor preview after Play |

## Example
```ts
new PlayModeController(preview, tilesets, toolbar, problems, {
  text: () => source.text,
  issues: (level) => issuesOf(level),
  repaint: () => repaint(),
});
```

## Design notes
Keeps Play independent of how the editor stores text or computes issues.
