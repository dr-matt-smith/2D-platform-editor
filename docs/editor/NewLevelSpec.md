# NewLevelSpec

`apps/editor/src/LevelDialog.ts` · interface

What the New level form produces.

## Relationships
- reported by [LevelDialog](LevelDialog.md) to `onNew`; used by [EditorApp](EditorApp.md) to build a blank level

## Members
| Member | Kind | Description |
|---|---|---|
| `id` | property | Tileset id, or `''` for the default (no `# tileset:` line) |
| `w`, `h` | properties | Size in cells, clamped to 4–200 |

## Example
```ts
{ id: 'Pixel Adventure 1', w: 24, h: 14 }
```

## Design notes
A plain data shape passed from the view to the editor.
