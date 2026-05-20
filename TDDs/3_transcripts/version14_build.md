# Transcript — Version 14: Playtest Uses the Active Tileset

A narrative record of the v14 phase: closing the gap between what the
editor preview shows and what the playtest plays. After this version
the editor renderer is the **single source of pixel truth** for both
modes — the playtest engine retains its role as the source of
*physics + state truth* only.

## The brief

The user pointed at the divergence: switch tilesets in the editor →
the preview re-renders with the active art, but pressing Play
launches with the static kaplay sprites vendored back in v9. They
asked for the playtest "to use the current tileset — so we can play
the level we are looking at when we press the play button".

## The architectural seed

The editor renderer (`src/renderer.js`) already knew how to paint a
parsed level under the active tileset — terrain mask, sprites,
decorations, sprite-frame cropping, decor pass. Almost everything in
a playtest stays cell-aligned: terrain doesn't move, coins disappear
(cell becomes empty), spikes don't move, the exit doesn't move. The
**player** is the only thing that moves continuously, on float
pixel coords.

So the v14 plan boiled down to:

1. Build a **view grid** = parsed grid with the player's spawn cell
   and any collected coin cells replaced by `.`.
2. Hand it to the editor renderer.
3. Overlay the player on top via `tileset.entityFor(playerChar)` or
   the editor's exact same `drawFallback` shape path.

~30 lines of `PlaytestScene.draw` replaced by a half-dozen lines that
delegate to the editor renderer and overlay one sprite. Engine code
(physics, AABB, collision, win/lose state) byte-untouched.

## Build

- **M1 — wire `tileset` through; export `drawFallback`.** `main.js`
  passes the active tileset object to `launchPlaytest(parsed, legend,
  tileset)`; launcher forwards it to `new PlaytestScene(..., tileset,
  exit)`; `PlaytestScene` constructor stores it. `renderer.js`'s
  internal `drawFallback` is hoisted to an exported function (same
  signature) so the player overlay can reuse the editor's exact
  shape path for image-less player glyphs (Dirt's blue disc, for
  one). No behaviour change in this milestone — the vendored entity
  `.draw()` methods still ran. 125 unit tests + 10 Playwright tests
  stayed green; the milestone is a silent wire-through.

- **M2 — `draw()` rewritten; `buildViewGrid` + tests.** A new pure
  helper `buildViewGrid(grid, clearedCells)` returns a fresh array
  of rows with the chosen cells set to `.`. `PlaytestScene.draw`
  builds the view grid (player spawn + collected coins), calls
  `editorDraw(ctx, viewParsed, this.tileset, TILE)`, then overlays
  the moving player at `Math.round(player.x), Math.round(player.y)`
  via the active tileset's `entityFor(playerChar)` if a sprite is
  authored, else `drawFallback`. `restart()` also locates the player's
  spawn cell + glyph char from the parsed grid via `roleOf(legend,
  char)`, falling back to `'P'` only if the legend lacks a
  role:player char (the launch gate normally rejects that). The
  vendored `Player`/`Coin`/`Spike`/`Goal` entity `.draw()` methods
  are no longer invoked by `PlaytestScene`; cleanup of those methods
  + the `public/play-assets/` vendor is the v15 candidate. Tests
  125 → 131 (+6 buildViewGrid cases).

- **M3 — Playwright proof + a timing race I learned from.** A new
  spec drives the editor in a real browser, launches playtest under
  Dirt and again under PlayWithYourPeas, screenshots each playtest
  canvas, and asserts the two md5s differ. First run passed the
  assertion — but the **Dirt screenshot showed shape fallback
  instead of autotiled dirt**. The cause was a race I'd missed:
  `legend?.querySelector('.glyph')` is true after the *initial*
  `renderLegend()` (which uses `DEFAULT_LEGEND` before the async
  `syncTileset()` finishes), so Ctrl+Enter could fire with
  `tileset` still null. A human user never trips this race (they
  take seconds to press Play); Playwright fires input immediately.
  Fix: `main.js` `syncTileset` now sets `window.__activeTileset`
  after the tileset is loaded, and the spec's `waitForEditorReady`
  waits on that flag. Re-run: Dirt playtest now shows the full
  autotiled dirt + grass + moon + drips + shape entities, matching
  the editor preview exactly. Hashes still differ from PWYP.

## Per-tileset outcomes

| Tileset | What the playtest shows now |
|---|---|
| Dirt | Autotiled dirt + grass / moon / drips (atlas decor pass); shape fallbacks for P/E/^/o (Dirt's lookup declares `image: null` for those, matching the preview) |
| PlayWithYourPeas | Pea player / Block terrain / Goal flag / Trap alert / Happy point |
| Pixel Adventure 1 | Crate terrain + Mask Dude (frame 0 cropped) + Apple (frame 0) + Checkpoint + Spikes against Sky-Blue background |
| Treasure Hunters | Palm-island terrain sheet (still squashed; multi-row atlas support is the v15+ candidate) + Captain + Gold Coin + Seashell |
| 2D Circle Graphic | Pavement + Door; shape fallbacks for entities |

Multi-glyph categories render per-char sprites in playtest — the
adapter still collapses every `pickup` glyph to a `Coin` for the win
counter, but the editor renderer paints each cell with its own char's
sprite. Decoration glyphs render and are inert (the player walks
through them, as the adapter already ignored them).

## What stayed out (v15+ candidates)

- **Animated playback** — Mask Dude actually cycling through his 11
  frames over time. Needs a clock; renderer becomes time-dependent.
- **State-changing exit** (`imageActive` when all pickups in) — small
  but unrelated to "play what you see".
- **Multi-row tile atlases** (Treasure Hunters palm-terrain 17×5) —
  needs a `cols × rows` schema and a 2D index in the renderer.
- **Cleanup** of the vendored entity `.draw()` methods + the unused
  `public/play-assets/` sprites + the launcher's now-pointless
  `loadSprite` calls. v15 follow-up.
- **Procedural-decor data** lifted into the lookup so other packs can
  author their own grass/moon/drips rules.
- **Keyboard nudge** on the v12/v13 splitters — still pending.

## The standing gap

Same as v13 — no automated DOM-mutation test of the broader
interactive surface beyond Playwright. v14 grew the e2e suite to 11
specs and the unit suite to 131 tests. The pattern that's settled —
pure helpers under `node --test`, real-browser flows under
Playwright — held up cleanly again, and exposed a real timing race
in the test surface that a human user would never hit.
