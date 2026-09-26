# `@2d-platform/render` — tilesets and the canvas renderer

What a level *looks like*:

- **[`Tileset`](../../docs/render/Tileset.md)** — `Tileset.load(id)` reads a
  tileset's `tile_lookup.json` and images, and answers "what do I draw for
  this glyph / this terrain mask?" (`entityFor`, `terrainFor`,
  `decorationFor`, `foregroundFor`), including animated sprite strips
  ([`SpriteStrip`](../../docs/render/SpriteStrip.md),
  [`SpriteAnimation`](../../docs/render/SpriteAnimation.md)) and the
  locked-exit variant. Each answer is a
  [`DrawSpec`](../../docs/render/DrawSpec.md) or `null`.
- **[`LevelRenderer`](../../docs/render/LevelRenderer.md)** —
  `new LevelRenderer(tileset, tile).draw(ctx, level, options?)` paints a
  parsed level onto a 2D canvas: autotiled terrain
  ([`TerrainMask`](../../docs/render/TerrainMask.md)), entities, decor, an
  optional camera window, plus `drawHud` for the playtest HUD band.
- **[`Palette`](../../docs/render/Palette.md)** — the sky colour and the
  fallback shapes drawn when a tileset has no image for a glyph.

The editor's preview and the engine's playtest both draw through this
package, so what you edit is pixel-identical to what you play.
Depends on `level-format`. Public API: [`src/index.ts`](src/index.ts).
Class diagram and one page per class, interface and enum:
[docs/render](../../docs/render/README.md). See also
[README_architecture.md](../../README_architecture.md).
