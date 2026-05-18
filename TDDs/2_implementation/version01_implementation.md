# Version 1 — Implementation Plan & Record

Status: Complete · Date: 2026-05-18 · Design:
[../1_design/version01_design.md](../1_design/version01_design.md)

This is a plan-of-record: v1 is fully implemented. Each milestone lists the
approach taken, the files, the tests, and the commit.

## Stack decisions

- Vite 7, vanilla JS (ESM), `<canvas>` preview, `localStorage`, no backend.
- Tests use the zero-dependency `node:test` runner (`npm test`). Pure modules
  (`level`, `renderer`, `validate`) are unit-tested without a DOM.
- One-directional data flow: textarea is the single source of truth →
  debounce → `parse` → `validate` + `render`.

## Module map

| File | Responsibility | Pure? |
|------|----------------|-------|
| `src/level.js` | parse/serialize, shared `LEGEND` | yes |
| `src/validate.js` | lint rules → `{line,col,severity,message}` | yes |
| `src/tileset.js` | atlas loader (`Image`), glyph→tile map | no (Image) |
| `src/renderer.js` | parsed+tileset → canvas pixels | yes (no DOM reads) |
| `src/main.js` | DOM wiring, debounce, rulers, persistence | no |

## Milestones

### M1 — level.js parse/serialize (`60a973c`)

- `parse(text)` → `{ meta, grid, rows }`. Header directives matched with a
  `# key: value` regex so a wall row (`####`) is never mistaken for one.
  Rows right-padded to declared/derived width; `rows[]` keeps original
  1-based file line numbers for validator line/col reporting.
- `serialize` emits canonical header + grid; `parse∘serialize∘parse` is
  stable. 5 round-trip/edge tests in `level.test.js`.

### M2 — tileset.js + pure renderer.js (`cb236b7`)

- `loadTileset()` always resolves (on image error → `ready:false`) so the
  renderer can degrade.
- `draw()` is pure; entities/hazard drawn as coloured shapes (no sprites in a
  dirt tileset). Tested with a fake 2D context counting calls.

### M3–M5 — validate.js + UI (`9a84aa1`)

- `validate()` rules: exactly one `P`, declared size match, no undefined
  glyphs (each with line/col); missing exit is a `warn`. 6 tests.
- `main.js`: 120 ms debounce loop; column ruler + line gutter aligned via a
  canvas-measured character width (`--cw`); `(x,y)` cursor readout mapped to
  grid coordinates; faint 5-cell guide gradients; `localStorage` mirror with a
  seeded sample; clickable problems panel that jumps the caret to `line:col`.

## Verification

- `npm test` — 14 tests green at v1 close (level 5, renderer 3, validate 6).
- `npm run build` — clean production bundle.
- Dev server smoke: app, tileset asset, and module transform all `200`.
- Acceptance (design §9): live preview within a debounce frame; specific
  line/col errors for two-`P`/undefined-glyph/size-mismatch; localStorage
  restore. All met.

## Deviations from the design

- Added a `test` script + `node:test` files (design implied tests but did not
  scope a runner) — chosen for zero dependencies.
- Rectangle fill remained out per design §2; bulk editing is text-only in v1.
