# ActiveTileset

`apps/editor/src/ActiveTileset.ts` · class

The tileset the open level uses (its `# tileset:` line) and the legend built
from it. Tilesets load lazily and are cached by id, so switching back never
refetches. Before the first load it holds the default legend and no tileset,
so the first paint needs no network.

## Relationships
- loads render's `Tileset` and builds level-format's `Legend`
- caches [LoadedTileset](LoadedTileset.md) promises
- read by [EditorApp](EditorApp.md), [LegendPanel](LegendPanel.md),
  [PlayModeController](PlayModeController.md) and [AgentController](AgentController.md)
- sets the `window.__activeTileset` test hook

## Members
| Member | Kind | Description |
|---|---|---|
| `tileset` | get accessor | The active `Tileset`, or null before the first load |
| `legend` | get accessor | Its `Legend` (the default until a tileset loads, or if it fails) |
| `lookup` | get accessor | The tileset's `tile_lookup.json`, if any |
| `thumbnailBase` | get accessor | Folder URL legend thumbnails resolve against |
| `warning` | get accessor | "unknown tileset …" when a named tileset failed to load, else null |
| `sync(id)` | async method | Make `id` active; resolves true if it changed |

## Example
```ts
if (await tilesets.sync(level.meta.tileset)) legendPanel.render();
const issues = level.validate(tilesets.legend);
```

## Design notes
- **Caching promises, not results.** Two quick calls for the same id share
  one load.
- **Degrade, never fail.** A tileset that cannot be loaded gives the default
  legend and a warning; the level is still drawn, with fallback shapes.
- **Read-only from outside.** State changes only through `sync`; everything
  else is a `get` accessor.
