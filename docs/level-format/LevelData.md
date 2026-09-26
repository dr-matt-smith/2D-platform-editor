# LevelData

`packages/level-format/src/LevelData.ts` · interface

The data of a parsed level with no behaviour attached: header values, the
padded grid, and the rows as written. Code that only *reads* a level depends
on this interface instead of the [Level](Level.md) class.

## Relationships
- implemented by [Level](Level.md)
- composed of a [LevelMeta](LevelMeta.md) and [LevelRow](LevelRow.md)s
- accepted by [LevelValidator](LevelValidator.md), [LevelRenderer](../render/LevelRenderer.md)'s `draw` (as `RenderLevel`) and the engine ([`World.fromLevel`](../engine/World.md), [`PlaytestScene`](../engine/PlaytestScene.md), [`Playtest.launch`](../engine/Playtest.md), [`JsPhysicsAdapter`](../engine/JsPhysicsAdapter.md))

## Members
| Member | Kind | Description |
|---|---|---|
| `meta` | readonly property | The [LevelMeta](LevelMeta.md) |
| `grid` | readonly property | `readonly string[]` — equal-width rows, padded with `Level.BACKGROUND_GLYPH` |
| `rows` | readonly property | `readonly LevelRow[]` — the grid rows before padding, with file lines |

## Example
```ts
import type { LevelData } from '@2d-platform/level-format';

function countCells(level: LevelData): number {
  return level.meta.width * level.meta.height;
}
countCells(Level.parse('###\n#P#'));   // a Level is a LevelData
```

## Design notes
- **Depend on interfaces, not classes.** The engine and renderer only need
  the data; typing them against `LevelData` keeps them from depending on how
  `Level` is built, and lets them accept a plain object (the playtest scene
  passes the renderer a modified copy of the grid).
- **Readonly throughout.** Readers cannot modify a level through the interface.
