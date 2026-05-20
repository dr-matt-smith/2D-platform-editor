# Version 10 — Implementation Plan

Status: Proposed · Date: 2026-05-20 · Design:
[../1_design/version10_design.md](../1_design/version10_design.md)

Fix the v8 decor-atlas limit visibly: render the editor preview per-cell
from the active tileset's lookup, so the three non-Dirt previews
(currently md5-identical, see [`v09 transcript`](../3_transcripts/version09_build.md))
become visually distinct. Renderer + loader change only — **no data
migration**.

## Process (same discipline as v8/v9)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run build` clean, `npm run build:pages` clean.
- **Path-scoped `git add` only — never `-A`.** The user's in-flight
  `fred.txt` / `above_ground2.txt` / `manifest.json` modifications stay
  out. See memory: [[scoped-git-add]].
- Pure parts unit-tested under `node --test`; the renderer visual
  outcome is gated by the existing Playwright harness extended in M3.

## Constraints & approach

- **Dirt's render is byte-identical** (back-compat gate). The renderer
  route for Dirt goes through new accessors that resolve to the same
  Image instances and the same `drawImage` arguments. Renderer test
  suite proves no regression.
- **No data file under `public/data/tilesets/` is modified.** The
  schema additions in design §4 are reader-side only; existing JSONs
  (Dirt's `filled` mask table; the four new sets' `glyphs[*].image`
  entries) already provide everything the new render path needs.
- **Decor stays atlas-gated and Dirt-only.** v10 declares this as a
  preserved limit, not a regression (design §5, §11).

## Module map

| File | Change |
|------|--------|
| `src/tileset.js` | parse `lookup.terrain.{default,masks}` + legacy `lookup.filled`; preload entity images by char; expose `terrainFor`, `entityFor`, `atlasReady`; keep `drawFilled`/`ready` as aliases |
| `src/tileset.test.js` | **new** — pure loader tests with a mocked `loadImage` (header + a couple of glyph chars + back-compat path) |
| `src/renderer.js` | lift the `ready` gate; per-cell fallback chain (design §5) |
| `src/renderer.test.js` | extended — entity/terrain fallback assertions on a tileset stub |
| `tests/tileset-screenshots.spec.js` | new mutual-distinctness assertion across manifest tilesets |

The four `tile_lookup.json` files under `public/data/tilesets/` are
**not modified**. Neither is `src/level.js`, `src/validate.js`,
`src/levels.js`, or anything under `src/play/`.

## Milestone 1 — Loader: schema + accessors (pure, tested)

1. `src/tileset.js`:
   - Parse `lookup.terrain` if present (`{default:{image},
     masks:{"0":…,"15":…}}`); legacy `lookup.filled` is aliased onto
     `terrain.masks` if `terrain.masks` itself is absent.
   - Preload images for every `terrain.masks[m].image` AND for
     `terrain.default.image` if present.
   - Preload entity images: iterate `lookup.glyphs` and, for each entry
     with a `char` AND an `image`, fetch the image, key it by `char`.
   - Expose:
     - `atlasReady: !!image` (alias of the old `ready`).
     - `terrainFor(mask) → Image|null` — resolves
       `masks[m]` ?? `default` ?? `glyphs.filled.image` (legend
       fallback) ?? `null`.
     - `entityFor(char) → Image|null` — resolves
       `entityImages[char]` ?? `null`.
   - Keep the old `ready`/`drawTile`/`drawFilled` exports (M2 still
     calls `drawTile` for decor; `drawFilled` becomes a thin
     compatibility shim until M2 lands).
2. `src/tileset.test.js` (new):
   - `loadTileset` with a fake fetch + a mocked `loadImage` returning
     unique stub objects per URL.
   - Cases: legacy `filled` table (Dirt-shape); new
     `terrain.masks`-only; `terrain.default`-only;
     `glyphs[X].image` resolves through `entityFor`;
     `glyphs.filled.image` resolves through `terrainFor` last; missing
     entry returns `null` (no throw).

Commit: `v10 m1: tileset loader — terrainFor/entityFor + schema additions (tested)`.

## Milestone 2 — Renderer: per-cell fallback chain

1. `src/renderer.js`:
   - Drop the `ready` gate. Always run the SKY `fillRect`. Run the
     atlas sky-blit pass only if `tileset?.atlasReady`.
   - Pass 2 (terrain): for each `#` cell compute `tileMask`,
     `im = tileset?.terrainFor?.(mask)`. If present:
     `ctx.drawImage(im, …, tile, tile)` (and record THIN cells only if
     the source mask matched **and** `atlasReady` so the decor pass
     respects them). Else `drawFallback('#')`.
   - Pass 3 (decor): unchanged, still gated on `atlasReady` —
     Dirt-only by design (v8 known limit, design §5).
   - Pass 4 (entities): for each non-`.`/non-`#` cell, try
     `tileset?.entityFor?.(g)`. If present: `drawImage` at tile size.
     Else: `drawFallback(g, …)` (today's path).
2. `src/renderer.test.js`:
   - Existing Dirt-shape assertions still pass (entityFor returns null
     for Dirt's null-image entities → shape fallback; terrainFor for
     mask m returns the same dirt-mask image).
   - New: a stub tileset with `entityFor` returning an Image for `P`
     and `terrainFor` returning an Image for any mask — assert the
     renderer calls `drawImage` for those cells (not the shape path).

Commit: `v10 m2: renderer per-cell fallback chain (Dirt byte-identical)`.

## Milestone 3 — Playwright: distinctness assertion

1. `tests/tileset-screenshots.spec.js`:
   - After the capture loop, hash each preview PNG (Node `crypto`
     `createHash('md5')`) and assert all four entries are pairwise
     distinct (with a clear failure message naming any two that hash
     the same).
2. Today this assertion is **red** (Pixel Adventure / PWYP / Treasure
   Hunters all hash `2ba7f2c8…`). After M2 it should be green.
3. **The fix order matters for the commit log:** land M3's assertion
   *after* M2 so the green check ratifies the fix.

Commit: `v10 m3: playwright mutual-distinctness assertion across tilesets`.

## Milestone 4 — Docs + transcript + delivered

`TDDs/3_transcripts/version10_build.md` (narrative, in the v8/v9 style);
mark design + impl Delivered with hashes; tick acceptance; update the
README's Live link block if anything visible to a returning user moved.

Commit: `v10 m4: docs + v10 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is pure** — loader extensions + new unit tests; no rendering
  change in the app. Dirt's runtime path goes through the new
  accessors but each call resolves to the same Image as before.
- **M2 is the behavioural change.** Risk surface: a Dirt subtle pixel
  diff from re-routing through `terrainFor`. Mitigation: the new code
  path for Dirt is `masks[m] → drawImage` with the same Image and the
  same args as the old `drawFilled` path. Renderer test asserts this
  exactly.
- **M2 doesn't fix Pixel Adventure 1's sheet-squash.** Documented
  cosmetic limit (design §6). Pixel Adventure's entity art will read
  as horizontal strips until v11's sprite-frame cropping. PlayWithYour-
  Peas and Treasure Hunters use mostly single-frame art and look clean
  immediately.
- **M3's assertion is a hash compare** — robust to deterministic
  rendering (same canvas size + same draw order = same PNG). The
  existing harness already produces deterministic shots (proven by the
  4 non-Dirt previews currently hashing identically).
- **No deploy risk** — `npm run build:pages` artifact is the same
  shape, slightly larger because the bundle includes a few more bytes
  of renderer code. Pages workflow is unchanged.

## Deferred (design §11 → v11)

Sprite-frame cropping; state-changing exit (`imageActive`);
decoration-category glyphs (paintable, no-collision); per-category
authorable variants (multi-glyph); procedural-decor data; auto-picked
cosmetic variants; convention-based autotile discovery.
