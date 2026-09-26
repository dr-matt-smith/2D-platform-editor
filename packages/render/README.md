# `@2d-platform/render` — tilesets and the canvas renderer

What a level *looks like*:

- **`tileset.ts`** — `loadTileset()` reads a tileset's `tile_lookup.json`
  and images, and answers "what do I draw for this glyph / this terrain
  mask?", including animated sprite strips and the locked-exit variant.
- **`renderer.ts`** — `draw()` paints a parsed level onto a 2D canvas:
  autotiled terrain (4-neighbour masks), entities, decor, an optional
  camera window, plus the playtest HUD band.
- **`palette.ts`** — fallback colours when a tileset image is missing.

The editor's preview and the engine's playtest both draw through this
package, so what you edit is pixel-identical to what you play.
Depends on `level-format`. Public API: [`src/index.ts`](src/index.ts).
See [README_architecture.md](../../README_architecture.md).
