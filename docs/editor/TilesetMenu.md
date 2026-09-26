# TilesetMenu

`apps/editor/src/TilesetMenu.ts` · class

The toolbar's Tileset menu (`#tilesetSel`), listing the tilesets manifest.
Choosing an entry reports its id; the editor rewrites the level's
`# tileset:` line.

## Relationships
- reads the manifest through [LevelLibrary](LevelLibrary.md)`.tilesets()`
- reports to [EditorApp](EditorApp.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new TilesetMenu(select, library, onChoose)` | constructor | |
| `populate()` | async method | Fill the menu (just Dirt if the manifest is missing) |
| `sync(id)` | method | Select `id`, adding `"<id> (missing)"` if it is not listed |

## Example
```ts
await tilesetMenu.populate();
tilesetMenu.sync(level.meta.tileset);
```

## Design notes
The menu always tells the truth: a level naming an unknown tileset shows it
as missing rather than silently showing another.
