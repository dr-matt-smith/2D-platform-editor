# ContentPaths

`apps/editor/src/ContentPaths.ts` · class

URLs of the game content the editor fetches. `BASE` is Vite's deploy base
(`/` in development, `/2D-platform-editor/` on GitHub Pages; `/` under
`deno test`).

## Relationships
- used by [LevelLibrary](LevelLibrary.md) and [ActiveTileset](ActiveTileset.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `BASE` | static readonly | The deploy base |
| `LEVELS_MANIFEST` | static readonly | `<BASE>data/levels/manifest.json` |
| `TILESETS_MANIFEST` | static readonly | `<BASE>data/tilesets/manifest.json` |
| `level(file)` | static method | `<BASE>data/levels/<file>` |
| `tilesetFolder(id)` | static method | `<BASE>data/tilesets/<id>/` |

## Example
```ts
fetch(ContentPaths.level('tutorial.txt'));
```

## Design notes
Named constants in one place instead of string templates scattered through
the code; a class with only statics, since there is no state.
