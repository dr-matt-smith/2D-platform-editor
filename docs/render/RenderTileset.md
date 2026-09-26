# RenderTileset

`packages/render/src/RenderTileset.ts` · interface

What [LevelRenderer](LevelRenderer.md) needs from a tileset. Only the atlas
members are required; each sprite method is optional, and a missing one is
treated like one that always answers `null`.

## Relationships
- implemented by [Tileset](Tileset.md)
- held by [LevelRenderer](LevelRenderer.md)
- the tileset type the engine passes around ([PlaytestScene](../engine/PlaytestScene.md), [Playtest](../engine/Playtest.md), [JsPhysicsAdapter](../engine/JsPhysicsAdapter.md))
- sprite methods return [DrawSpec](DrawSpec.md)s; `entityFor` takes an [EntityState](EntityState.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `atlasReady` | readonly property | Can `drawTile` be used? |
| `drawTile(ctx, index, dx, dy, size)` | method | Draw an atlas tile into a cell |
| `terrainFor?(mask, now?)` | optional method | Terrain sprite for a [TerrainMask](TerrainMask.md) value |
| `entityFor?(char, now?, state?)` | optional method | Entity sprite |
| `decorationFor?(char, now?)` | optional method | Decoration sprite |
| `foregroundFor?(char, now?)` | optional method | Foreground sprite |
| `backgroundImage?(id)` | optional method | A whole-level background image |

## Example
```ts
// A test fake: no atlas, every '#' drawn with one image.
const fake: RenderTileset = {
  atlasReady: false,
  drawTile() {},
  terrainFor: () => DrawSpec.whole(blockImage),
};
new LevelRenderer(fake, 8).draw(ctx, Level.parse('###'));
```

## Design notes
**Interface segregation.** The renderer states the smallest contract it
needs. [Tileset](Tileset.md) has more (its `lookup`, `decorationImage`, …)
but the renderer never sees it, and tests implement only what they check.
