# LevelRenderer

`packages/render/src/LevelRenderer.ts` · class

Draws a level onto a 2D canvas with a tileset, plus the HUD band above it.
The editor preview and the playtest both draw through this class, so what
the author edits looks exactly like what they play.

## Relationships
- has a [RenderTileset](RenderTileset.md) (usually a [Tileset](Tileset.md)), or `null` for shapes only
- draws a `RenderLevel` (`Pick<LevelData, 'grid' | 'meta'>` — a level-format `Level` fits)
- takes [DrawOptions](DrawOptions.md) per frame; a [CameraWindow](CameraWindow.md) in them becomes a [CellRange](CellRange.md)
- autotiles terrain with [TerrainMask](TerrainMask.md); draws [DrawSpec](DrawSpec.md)s
- takes colours and fallback shapes from [Palette](Palette.md) / [FallbackStyle](FallbackStyle.md)
- used by the editor (`run()` in `apps/editor/src/main.ts`) and the engine's `PlaytestScene`

## Members
| Member | Kind | Description |
|---|---|---|
| `HUD_HEIGHT_TILES` | static readonly | `1` — the HUD band's height in cells |
| `new LevelRenderer(tileset, tile?)` | constructor | `tile` is the cell size in canvas pixels (default 24) |
| `tileset` | readonly property | The [RenderTileset](RenderTileset.md), or `null` |
| `tile` | readonly property | Cell size in pixels |
| `hudHeight` | get accessor | `HUD_HEIGHT_TILES × tile` |
| `draw(ctx, level, options?)` | method | Size the canvas and paint the level below the HUD band (see passes below) |
| `drawHud(ctx, text)` | method | Paint the HUD band with `text`, in the page's `--hud-bg` / `--hud-fg` colours |
| `drawEntity(ctx, glyph, x, y, now?, state?)` | method | One glyph at canvas position (x, y): its sprite, else its fallback shape. The playtest draws the moving player with it |
| `drawFallback(ctx, glyph, x, y, size)` | static method | The glyph's [Palette](Palette.md) fallback shape, or nothing |

`draw` paints in passes, back to front:

| # | Pass | Draws | Needs |
|---|---|---|---|
| 1 | sky | [Palette](Palette.md)`.SKY` over the whole canvas, then the level's `# background-image:` stretched over the world | — / `backgroundImage` |
| 2 | sky tiles | an atlas sky (or cave) tile under every cell | `atlasReady` |
| 3 | terrain | `terrainFor(mask)` per `#` cell, else a fallback block | — |
| 4 | decor | atlas grass, drips, moon and stars, placed by a hash of the cell | `atlasReady` |
| 5 | decorations | `decorationFor(glyph)` | — |
| 6 | entities | `entityFor(glyph)`, else a fallback shape (never for decoration or foreground glyphs) | — |
| 7 | foreground | `foregroundFor(glyph)` | — |

With a camera the canvas is the size of the view, the world is shifted by
the (rounded) camera position, and only the visible cells are visited. The
canvas transform is restored before `draw` returns, so callers draw over it
in canvas pixels.

## Example
```ts
import { LevelRenderer, Tileset } from '@2d-platform/render';

const renderer = new LevelRenderer(await Tileset.load(level.meta.tileset), 24);

// Editor preview: whole level, still.
renderer.draw(ctx, level);
renderer.drawHud(ctx, 'HUD: score / status');

// Playtest frame: animated, scrolled, exit shown locked.
renderer.draw(ctx, level, {
  now: performance.now(),
  camera: { camX, camY, viewW: 480, viewH: 320 },
  entityState: { exitLocked: true },
});
renderer.drawEntity(ctx, 'P', px, py + renderer.hudHeight, performance.now());
```

## Design notes
- **One public method per job, private methods per pass.** `draw` reads as
  the list of passes; each pass is a small private method with one comment.
  The per-call data they share (context, grid, cells, time) is bundled in a
  private `Frame` object rather than stored on the renderer, so a renderer
  holds no state between calls and can be reused freely.
- **Depend on an interface.** It holds a [RenderTileset](RenderTileset.md), not
  a [Tileset](Tileset.md), so the tests drive it with small fakes that count
  calls — and the draw-call sequences they check are exactly those of the
  function-based version this class replaced.
- **Options object.** Rarely used settings (`now`, `camera`, `entityState`)
  travel in [DrawOptions](DrawOptions.md) instead of a long list of optional
  positional arguments.
- **Graceful fallback.** Any sprite the tileset lacks becomes a coloured
  shape, so every level is visible with every tileset, or with none.
