# 2D Level Designer — Version 1 Design Document

Status: Draft · Date: 2026-05-15 · Supersedes: none · Source ideas: [version00_ideas.md](../3_transcripts/version00_ideas.md)

## 1. Purpose

A text-based level editor for simple 2D games (mazes and platformers). Levels
are authored as a monospace ASCII grid; a tile-rendered preview updates live
beside the text. The v1 goal is the smallest tool that is genuinely pleasant to
use — not a feature-complete editor.

## 2. Scope

### In scope for v1

Per the prioritisation in the source ideas doc, v1 ships exactly these five
features:

1. **Monospace editor + grid guides** — fixed-width text area with column/row
   rulers, faint guide lines every 5 cells, and a live `(x, y)` cursor readout.
2. **Live preview** — split pane; ASCII source on the left, tile-rendered canvas
   on the right, re-rendered on edit (debounced).
3. **Rectangle fill** — drag a rectangle in the preview (or enter coordinates)
   and fill it with the active glyph.
4. **Validation** — inline lint: exactly one player spawn, declared dimensions
   match actual, no undefined glyphs. Errors listed with line/column.
5. **Fast play-test** — out of scope for *running a game* in v1; instead, a
   "validate + preview at cursor" action standing in for the play-test loop
   until a runtime exists. (Flagged as a known gap — see §8.)

### Explicitly out of scope for v1

Layers / multi-character cells, entity properties, flood fill, line tool,
symmetry/stamps, undo history beyond the browser textarea default, minimap,
jump-to-coordinate, templates/procedural generation, file persistence beyond
localStorage, and an actual game runtime. These are tracked for later versions.

## 3. Tech stack

- **Build/dev:** Vite 7 (vanilla JS, ESM). `npm run dev` for local work.
- **Language:** plain JavaScript, no framework. The editor is small and
  DOM-light; a framework would be premature.
- **Rendering:** `<canvas>` 2D context for the tile preview.
- **Assets:** `public/assets/tilesets/Dirt_Platformer_Tiles/platformertiles.png`
  (256×96, RGBA). Assumed 32×32 tiles → an 8×3 grid (24 tiles). Tile size and
  atlas layout are declared in a tileset config object, not hard-coded at call
  sites, so a different atlas can be swapped in.
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
  row) are directives: `name`, `size` (`WxH`). A `//` line anywhere is a
  comment, stripped at parse time.
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
|  rulers + textarea       |  tileset palette          |
|  (monospace, grid guides)|  canvas preview           |
|                          |  cursor (x,y) readout     |
+--------------------------+---------------------------+
|  validation panel: line:col — message                |
+------------------------------------------------------+
```

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
| 6 | Rectangle fill via palette + drag                        |

## 8. Open questions / known gaps

- **Play-test loop:** v1 has no game runtime, so the highest-leverage feature
  from the ideas doc (fast play-test) is only partially served. Decide whether
  v2 embeds a tiny reference platformer or exports to an external runner.
- **Tile metadata:** 32×32 / 8×3 atlas layout is assumed from the image size
  and the OpenGameArt source; needs visual confirmation against the PNG.
- **Coordinate origin:** top-left `(0,0)`, x right, y down — confirm this
  matches whatever runtime consumes the levels later.
- **Undo:** relying on the browser textarea undo for v1; a custom history
  stack is deferred but will be needed once non-text edits (rectangle fill)
  become common, since those bypass native undo.

## 9. Acceptance criteria for v1

- `npm run dev` serves the editor; editing the grid updates the preview within
  ~one frame of the debounce.
- A level with two `P`s, an undeclared glyph, or a size mismatch produces
  specific line/column errors.
- Rectangle fill changes both the canvas and the textarea text consistently.
- Reloading the page restores the last-edited level from localStorage.
