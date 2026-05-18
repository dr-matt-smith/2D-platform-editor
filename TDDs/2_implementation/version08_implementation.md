# Version 8 — Implementation Plan

Status: Planned (design Draft) · Date: 2026-05-18 · Design:
[../1_design/version08_design.md](../1_design/version08_design.md)

A forward plan: v8 is not yet built. **Consumer-side only — zero engine
risk** (the v7 mask renderer is untouched). One milestone per commit;
**stage path-scoped, then read `git status --short` as its own step** before
committing (the user is still authoring `above_ground2.txt` / regenerating
`levels/manifest.json` — never sweep those in); `npm test` green and
`npm run build` clean before each.

## Constraints & approach

- `renderer.js` is **not touched**. v8 is `level.js`/`validate.js`/
  `tileset.js`/`main.js`/`loaderDialog.js`/`levels.js` + a `tile_lookup.json`
  data edit.
- **Back-compat is the gate.** `validate` gains an *optional* `legend`
  param defaulting to a static `DEFAULT_LEGEND` (the Dirt glyph set), and
  `LEGEND` stays exported as an alias of it. Result: `validate.test.js` and
  every existing importer keep working unchanged; a default/`Dirt` level is
  byte-identical to v7.
- New edit logic stays pure where possible (`buildLegend` is pure); the
  async tileset load is confined to `main.js`.
- Grid chars never change ⇒ **no level/draft/`localStorage` migration**.

## Module map

| File | Change |
|------|--------|
| `level.js` | `meta.tileset` parse/serialize; `DEFAULT_LEGEND` + `buildLegend(lookup)`; `LEGEND` → alias |
| `validate.js` | `validate(parsed, legend = DEFAULT_LEGEND)` (only sig change) |
| `tileset.js` | `loadTileset(id = 'Dirt_Platformer_Tiles')` resolves `/data/tilesets/<id>/` |
| `tile_lookup.json` | complete `glyphs` (add `filled`, `color`, role; Wall→Filled, Empty) |
| `main.js` | per-level async tileset load → `buildLegend` → thumbnail legend → `validate(parsed, legend)`; unknown-tileset `warn` |
| `levels.js` | `tilesets()` → fetch tilesets manifest |
| `loaderDialog.js` | "New level" affordance → tileset + size chooser |
| `palette.js` | **new** — shared entity/sky colour constants (single source for renderer + the 2a drift test) |
| `renderer.js` | **logic unchanged**; `FALLBACK`/`SKY` moved to `palette.js` and imported back (mechanical; existing renderer suite proves no behaviour change) |

## Milestone 1 — `meta.tileset` + legend builder (pure)

1. `level.js`: `parse` reads `# tileset:` → `meta.tileset`
   (default `'Dirt_Platformer_Tiles'`; value stored verbatim, validity is an
   app concern §M4). `serialize` emits `# tileset:` only when non-default
   (mirrors `theme`).
2. `DEFAULT_LEGEND` = the Dirt glyph set as a static object
   (`{ '.': {name:'Empty',role:'background',color:'#1b2a3a'}, '#':
   {name:'Filled',role:'terrain'...}, … }`); `export const LEGEND =
   DEFAULT_LEGEND` (deprecated alias). `buildLegend(lookup)` → same
   char-keyed shape from `lookup.glyphs`.
3. Tests (`level.test.js`): `# tileset:` parse default + explicit;
   serialize round-trip (non-default emitted, default omitted);
   `buildLegend` of a sample lookup yields the expected char map;
   `LEGEND === DEFAULT_LEGEND`.

Commit: `v8 m1: meta.tileset + DEFAULT_LEGEND/buildLegend (pure, tested)`.

## Milestone 2 — `validate` takes a legend

1. `validate.js`: `import { DEFAULT_LEGEND }`; signature
   `validate(parsed, legend = DEFAULT_LEGEND)`; use `legend` for the
   undefined-glyph rule.
2. `validate.test.js`: unchanged calls still pass (default = Dirt = old
   keys). Add one test passing a *custom* legend (e.g. no `o`) and asserting
   `o` is then flagged — proves tileset-awareness.

Commit: `v8 m2: validate(parsed, legend?) — tileset-aware glyph set`.

## Milestone 3 — `tile_lookup.json` glyphs + `loadTileset(id)`

1. Complete `tile_lookup.json` `glyphs` per design §4: add `filled`
   (`image: tiles/01_dirt_top.png` — textured/legible, legend-only),
   `role`, and `color` on the image-less entries; `name` "Empty"/"Filled"
   (the Wall→Filled change, data-only).
2. `tileset.js`: `loadTileset(id = 'Dirt_Platformer_Tiles')`; derive
   `base = '/data/tilesets/' + id + '/'`; lookup + atlas + filled images
   from `base`. Behaviour for Dirt is identical (default arg).
3. Extract `FALLBACK`/`SKY` from `renderer.js` into new `src/palette.js`;
   `renderer.js` imports them (mechanical, no logic change — the existing
   renderer suite is the proof). **Drift-guard test (2a):** assert every
   shared glyph's `tile_lookup.json` `color` equals `palette`; catches the
   duplication diverging until v9's 2c retires palette+test.

Commit: `v8 m3: complete tile_lookup glyphs (Wall→Filled) + loadTileset(id)`.

## Milestone 4 — per-level tileset wiring + thumbnails (the real change)

1. `main.js`: an `ensureTileset(id)` that loads & **caches** by id (avoids
   reloading the same set on every switch). On level load/switch and on a
   debounced edit whose `meta.tileset` changed: `await ensureTileset` →
   `legend = lookup ? buildLegend(lookup) : DEFAULT_LEGEND` → `renderLegend()`
   → `run()`.
2. `run()`: `validate(parsed, legend)`; if the requested tileset id was not
   found (fell back), append a synthetic `warn` ("unknown tileset '<id>',
   using default") to the problems list — non-blocking, no crash.
3. `renderLegend()`: per entry, `<img>` of `base+image` (pixelated, small)
   or a `color` swatch when `image` is null; keep char+name, the
   click-to-set-active-glyph behaviour, and the active highlight.
4. Re-sequence startup: today `loadTileset()` runs once at line ~97; move it
   into the load flow so the tileset matches the loaded level.
5. Dev smoke: default level unchanged (legend now thumbnailed, shows
   "Empty"/"Filled"); a hand-made `# tileset: Nope` level shows the warn and
   still renders via Dirt.

Commit: `v8 m4: per-level tileset load + thumbnail legend + unknown notice`.

## Milestone 5 — New empty level + tileset chooser

1. `levels.js`: `tilesets()` → injected `fetch('/data/tilesets/manifest.json')`
   → `[{id,name}]`; unit-test with the fake fetch.
2. `loaderDialog.js`: a **"New level"** row → step to pick a tileset
   (manifest) + **custom width/height number inputs** with preset
   quick-fills (24×14 / 40×16); W/H clamped 4–200; emits
   `onNew({ id, w, h })`.
3. `main.js`: build the buffer — `# name: untitled`, `# size: WxH`,
   `# tileset: <id>` (omitted if default), then `H` rows of the tileset's
   empty char; `currentId = null` (unsaved, like the offline sample); run
   the load flow (so its tileset/legend apply).

Commit: `v8 m5: new empty level + tileset chooser`.

## Milestone 6 — docs + transcript

`public/data/levels/README.md` note on `# tileset:`; `tile_lookup.json`
glyphs documented; `TDDs/3_transcripts/version08_build.md`; mark this plan
Delivered with hashes; tick design §10.

Commit: `v8 m6: docs + v08 transcript`.

## Risks & sequencing

- **M1–M3 are pure/data and independent** — safe first; the back-compat
  alias + default param mean the suite stays green with no test churn beyond
  additions.
- **M4 is the only behavioural change**: level load becomes async on the
  tileset. Mitigation: `ensureTileset` caches by id; the common path (all
  levels are Dirt today) loads once. A debounced edit only reloads if
  `meta.tileset` actually changed (cheap string compare).
- **Decor is still Dirt-atlas-bound.** v8 makes *filled* tiles
  tileset-driven; grass/moon/stars/drips/bg still come from the Dirt atlas.
  A genuinely different second tileset (v9) needs decor data too — out of
  scope, flagged so the abstraction's current limit is explicit.
- **No automated DOM test** for the thumbnail legend / new-level dialog —
  dev-smoke + the unchanged render harness, the standing gap since v2. The
  pure parts (`buildLegend`, `tilesets()`, `validate` legend) *are*
  unit-tested.

## Deferred (design §13 → v9)

**2c**: renderer reads image-less glyph colour from the loaded lookup
(single source; retires the v8 drift-guard test). Touches the engine, hence
v9. Also: a real second tileset (end-to-end proof, incl. decor data);
hazard/pickup variant picker UI; 47-blob 8-neighbour; flood/line tool;
reachability lint;
play-test runtime; level create/rename/delete.
