# 2D Level Designer — Version 1 Design Document

Status: Draft · Date: 2026-05-15 · Supersedes: none · Source ideas: [version00_ideas.md](../3_transcripts/version00_ideas.md)

## 1. Purpose

A text-based level editor for simple 2D games (mazes and platformers). Levels
are authored as a monospace ASCII grid; a tile-rendered preview updates live
beside the text. The v1 goal is the smallest tool that is genuinely pleasant to
use — not a feature-complete editor.

## 2. Scope

### In scope for v1

Per the prioritisation in the source ideas doc, v1 ships these four features
(rectangle fill is deferred — see below):

1. **Monospace editor + grid guides** — fixed-width text area with column/row
   rulers, faint guide lines every 5 cells, and a live `(x, y)` cursor readout.
2. **Live preview** — split pane; ASCII source on the left, tile-rendered canvas
   on the right, re-rendered on edit (debounced).
3. **Validation** — inline lint: exactly one player spawn, declared dimensions
   match actual, no undefined glyphs. Errors listed with line/column.
4. **Fast play-test** — out of scope for *running a game* in v1; instead, a
   "validate + preview at cursor" action standing in for the play-test loop
   until a runtime exists. (Flagged as a known gap — see §8.)

### Explicitly out of scope for v1

Rectangle fill (deferred from v1 — text-only editing for now), layers /
multi-character cells, entity properties, flood fill, line tool,
symmetry/stamps, undo history beyond the browser textarea default, minimap,
jump-to-coordinate, templates/procedural generation, file persistence beyond
localStorage, and an actual game runtime. These are tracked for later versions.

## 3. Tech stack

- **Build/dev:** Vite 7 (vanilla JS, ESM). `npm run dev` for local work.
- **Language:** plain JavaScript, no framework. The editor is small and
  DOM-light; a framework would be premature.
- **Rendering:** `<canvas>` 2D context for the tile preview.
- **Assets:** `public/assets/tilesets/Dirt_Platformer_Tiles/platformertiles.png`
  *(moved to `public/data/tilesets/…` in v3 — see version03_design.md)*
  (256×96, RGBA). **Confirmed** 32×32 tiles → an 8×3 grid (24 tiles): a
  9-slice dirt block plus sky, moon and transparent decor overlays. Tile size
  and atlas layout are declared in a tileset config object, not hard-coded at
  call sites, so a different atlas can be swapped in. Per-tile names and roles
  are sliced to `public/.../Dirt_Platformer_Tiles/tiles/` with a `tiles.json`
  manifest.
- **Persistence:** the current level text is mirrored to `localStorage` so a
  refresh does not lose work. No backend.

## 4. Level format

Plain UTF-8 text. A level is an optional header block followed by the grid.

```
# name: tutorial-01
# size: 20x12
####################
#..................#
#...P..............#
#........####......#
#..................#
####################
```

- Lines beginning with `#` *in the header region only* (before the first grid
  row) are directives: `name`, `size` (`WxH`), and `theme` (`sky` | `cave`,
  default `sky`). A `//` line anywhere is a comment, stripped at parse time.
- `theme` selects renderer styling only (background + decor); it does not
  affect gameplay glyphs or validation. Unknown values fall back to `sky`.
- After the header, every line is a grid row. Rows are right-padded with `.`
  to the declared width on parse; ragged input is allowed while editing and
  flagged by validation if `size` is declared and mismatched.

### Glyph legend (v1)

| Glyph | Meaning      | Tile role        |
|-------|--------------|------------------|
| `.`   | empty / air  | background       |
| `#`   | solid wall   | terrain          |
| `P`   | player spawn | entity (exactly 1) |
| `^`   | hazard/spike | terrain          |
| `o`   | collectible  | entity           |
| `E`   | exit/goal    | entity (≥1)      |

Legend is data, defined in one `legend` map shared by the renderer and the
validator so the two cannot disagree.

## 5. Architecture

Single-page app, four modules under `src/`:

- `main.js` — bootstrap, wires DOM, owns the debounce loop.
- `level.js` — parse text → `{ meta, grid, errors }`; serialize back.
- `renderer.js` — given a parsed grid + tileset, draw to canvas. Pure: input
  in, pixels out, no DOM reads.
- `validate.js` — given a parsed level, return `[{ line, col, message }]`.
- `tileset.js` — load the atlas image, expose `drawTile(ctx, id, x, y)` and the
  legend→tile mapping.

Data flow: textarea `input` → debounce (~120 ms) → `level.parse` →
`validate` (render error list) → `renderer.draw` (update canvas). One
direction; the textarea is the single source of truth.

## 6. UI layout

```
+--------------------------+---------------------------+
|  rulers + textarea       |  canvas preview           |
|  (monospace, grid guides)|  cursor (x,y) readout     |
|                          |  glyph legend (reference) |
+--------------------------+---------------------------+
|  validation panel: line:col — message                |
+------------------------------------------------------+
```

Editing in v1 is text-only (type into the textarea); the legend is a
read-only reference, not an interactive palette.

Dark, monospace throughout (matches a text-first tool and the existing
`src/style.css`).

## 7. Milestones

| # | Deliverable                                              |
|---|----------------------------------------------------------|
| 1 | `level.js` parse/serialize + unit-tested round-trip      |
| 2 | `tileset.js` + `renderer.js` drawing a static level      |
| 3 | Live textarea → debounce → re-render loop                |
| 4 | Grid guides, rulers, `(x,y)` readout, localStorage       |
| 5 | `validate.js` + inline error panel                       |

## 8. Open questions / known gaps

- **Play-test loop:** v1 has no game runtime, so the highest-leverage feature
  from the ideas doc (fast play-test) is only partially served. Decide whether
  v2 embeds a tiny reference platformer or exports to an external runner.
- **Tile metadata:** ~~assumed~~ **RESOLVED** — confirmed by pixel inspection
  as a 32×32 8×3 atlas (9-slice dirt block + sky/moon/decor); sliced and named
  in `tiles.json`. Autotiling + a themed decor layer were subsequently built
  (pulled forward from v2 #6), so the example levels render close to their
  source screenshots.
- **Coordinate origin:** top-left `(0,0)`, x right, y down — confirm this
  matches whatever runtime consumes the levels later.
- **Undo:** v1 is text-only, so the browser textarea undo is sufficient. A
  custom history stack becomes necessary once non-text edits (e.g. the
  deferred rectangle fill) are added, since those bypass native undo — revisit
  alongside whichever version reintroduces rectangle fill.

## 9. Acceptance criteria for v1

- `npm run dev` serves the editor; editing the grid updates the preview within
  ~one frame of the debounce.
- A level with two `P`s, an undeclared glyph, or a size mismatch produces
  specific line/column errors.
- Reloading the page restores the last-edited level from localStorage.

## 10. v2 candidates

Not commitments — a ranked backlog to revisit once v1 ships, roughly highest
leverage first:

1. **Rectangle fill** (deferred from v1). Highest priority: v1 is
   character-by-character typing only, which the source ideas doc calls
   "miserable for anything larger than ~20×20." Pulls in a custom undo stack
   (see §8) since non-text edits bypass native textarea undo.
2. **A real play-test runtime** — closes the biggest gap from §8. Decide:
   embed a tiny reference platformer vs. export to an external runner. This
   is what makes the "fast play-test" feature real rather than a stand-in.
3. **Flood fill + line tool** — natural companions to rectangle fill; share
   the same selection/undo machinery, so cheap to add once (1) lands.
4. **Jump-to-coordinate + minimap** — navigation for levels larger than the
   viewport.
5. **Templates / procedural seeds** — fight the blank-page problem (empty
   bordered room, maze skeleton).
6. ~~**Autotiling + decor layer**~~ **DONE** (pulled forward) — 9-slice
   autotiling + a `theme`-driven decor pass (sky/moon/stars/grass vs.
   cave/drips) now render the example levels close to their screenshots.
   Possible follow-ups: per-tile variant randomisation, parallax decor,
   more themes.

Layers / multi-character cells and entity properties remain further out: they
change the level format and the parser, so they warrant their own design pass
rather than a v2 bullet.
