# LevelDialog

`apps/editor/src/LevelDialog.ts` · class

The Levels dialog (New button, Ctrl/Cmd+O). One backdrop, two views: the
list of levels (pick or download one) and the New level form (tileset and
size, with presets). It only reports the user's choice; the editor loads.

## Relationships
- extends [ModalDialog](ModalDialog.md)
- configured by [LevelDialogOptions](LevelDialogOptions.md); lists [LevelLibrary](LevelLibrary.md)`.list()`
- produces a [NewLevelSpec](NewLevelSpec.md)
- opened by [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `SIZE_MIN`, `SIZE_MAX` | static readonly | `4`, `200` — the size limits |
| `PRESETS` | static readonly | `24×14` and `40×16` |
| `new LevelDialog(options)` | constructor | |
| `clampSize(value)` | static method | A typed size as a whole number within the limits |
| `render()` | protected method | Show the list view |
| `dismiss()` | protected method | Close, choosing nothing |

## Example
```ts
new LevelDialog({ library, currentId, onSelect: switchTo, onNew: newLevel }).open();
```

## Design notes
Two views share one backdrop, so the base class's Esc and outside-click
handling covers both. The size rule is a static method, unit-tested.
