# 2D Platform Editor

**GitHub:** https://github.com/dr-matt-smith/2D-platform-editor

A text-based level editor for simple 2D platformer / maze games. Author
levels as ASCII grids in a textarea with live tile-mapped preview, then
**playtest them in the browser** with a real physics engine — no export,
no leaving the page.

## Quick start

```bash
npm install
npm run dev       # editor at http://localhost:5173
npm test          # node --test
npm run build     # production bundle in dist/
```

`npm run gen` regenerates the levels and tilesets manifests; `predev` /
`prebuild` hooks run it automatically.

## Editor

- ASCII grid with header directives (`# name:`, `# size: WxH`,
  `# tileset:`, `# theme:`) and `//` line comments.
- Live canvas preview with autotiled terrain (4-neighbour mask) and
  per-tileset decor (sky / cave themes).
- Tileset-derived **legend** with thumbnails — click to set the active
  glyph; drag on the preview to fill a rectangle (Shift = hollow outline).
- Problems panel with click-to-jump (line/col), undo/redo, drafts per
  level in `localStorage`, levels dialog, downloadable `.txt`.

### Level format

```
# name: tutorial-01
# size: 24x10
# tileset: Dirt_Platformer_Tiles
########################
#......................#
#...P.............E....#
…
```

Glyphs (names come from the active tileset's `tile_lookup.json`):
`.` empty · `#` filled · `P` spawn (exactly one) · `E` exit · `^` hazard
· `o` pickup.

## Playtest (v9)

Press **Play** (or **Ctrl/Cmd+Enter**) to play the *current buffer* —
unsaved edits included — with the mechanic vendored from
[`simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
(@4c3b936, CC BY 4.0). Win: collect every `o` then touch an `E`. Lose:
touch a `^` or fall off the world. `R` restarts, `Esc` exits.

The launch gate is **stricter than the editor lint**: a missing `E` is a
hard block (the win is otherwise unreachable), reported in the problems
panel instead of opening the overlay. Arbitrary level sizes play
scale-to-fit (no camera).

## Project layout

```
src/              editor (parse, validate, renderer, levels, history, …)
src/play/         vendored playtest engine + adapter + gate + scene
public/data/      bundled levels and tilesets (+ generated manifests)
public/play-assets/  CC BY 4.0 sprites for playtest (LICENSE + sources.md)
TDDs/             per-version Design / Implementation / Transcript docs
scripts/          manifest generators (pre-dev/build hooks)
```

## Versioning model

Each version ships as a TDD trio under `TDDs/`:
`1_design/versionNN_design.md` → `2_implementation/versionNN_implementation.md`
→ `3_transcripts/versionNN_build.md`, one path-scoped commit per
milestone. Current version: **v9** (playtest mode).

## Licence

The editor itself is **MIT** (see `package.json`). The vendored playtest
engine and sprites under `public/play-assets/` are **CC BY 4.0**
(`public/play-assets/LICENSE`, attribution in `public/play-assets/sources.md`).
