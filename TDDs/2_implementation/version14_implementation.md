# Version 14 — Implementation Plan

Status: **Delivered (M1–M3)** · Date: 2026-05-21 · Design:
[../1_design/version14_design.md](../1_design/version14_design.md) ·
Transcript: [../3_transcripts/version14_build.md](../3_transcripts/version14_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `1cff612` | wire `tileset` through `main → launcher → PlaytestScene`; export `drawFallback` from `renderer.js` |
| 2 | `4e159a6` | `buildViewGrid` pure helper + `PlaytestScene.draw` rewritten to delegate to the editor renderer + overlay the moving player; 125 → 131 tests |
| 3 | _this commit_ | Playwright playtest-by-tileset spec (Dirt ≠ PlayWithYourPeas); `main.js` exposes `window.__activeTileset` to defeat a Playwright-only race; v14 transcript; design + impl Delivered |

Outcome: 125 → 131 unit tests (+6 view-grid splice cases),
Playwright 10 → 11 (+1 visible-payoff spec). Both builds clean.
The playtest now uses the active tileset's art for every shipped
tileset; engine code (physics + state) byte-untouched.

A single focused feature: PlaytestScene's `draw()` is rewritten to
delegate the static layer to the editor renderer and overlay only the
moving player on top. Three small path-scoped commits.

## Process (same discipline as v8–v13)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- Pure parts unit-tested under `node --test`; the visible playtest
  art is Playwright-tested.

## Constraints & approach

- **Engine code stays untouched.** Vendored `Player.update()`,
  `rectsOverlap`, `resolveAxis`, the AABB physics — all unchanged.
  v14 only touches the *drawing* side of `PlaytestScene` and the
  wiring that hands it the active tileset.
- **Editor renderer is the single source of pixel truth.**
  Importing `draw` from `src/renderer.js` into `src/play/play-
  testScene.js` is the only new cross-module dependency. The
  existing renderer test suite (29 cases as of v13) is the
  back-stop for any rendering regression.
- **Pure helper for the view-grid splice** lives at the top of
  `playtestScene.js` (or a tiny new helper file) so `node --test`
  can exercise it without a DOM.

## Module map

| File | Change |
|------|--------|
| `src/renderer.js` | export `drawFallback` so the player overlay can reuse the editor's image-less shape path (Dirt's blue disc) |
| `src/play/playtestScene.js` | constructor stores `tileset`; new pure helper `buildViewGrid(grid, player, coins, legend)`; `draw(ctx)` delegates to `editorDraw` + overlays the player |
| `src/play/playtestScene.test.js` (new) | unit tests for `buildViewGrid` (player cell cleared, collected-coin cells cleared, uncollected cells preserved, decorations untouched) |
| `src/play/launcher.js` | accepts `tileset`, forwards to `PlaytestScene` |
| `src/main.js` | passes the active `tileset` to `launchPlaytest()` |
| `tests/playtest-tileset.spec.js` (new) | a Playwright spec: open a level under PWYP, press Play, screenshot the playtest canvas, assert it contains the Pea sprite (or simply assert pixel diversity vs. a Dirt playtest screenshot — they should differ) |

## Milestone 1 — Wire `tileset` through; export `drawFallback`

1. `src/main.js`: change `launchPlaytest(parse(src.value), legend)`
   to `launchPlaytest(parse(src.value), legend, tileset)`. The
   `tileset` variable is already loaded by the existing per-level
   tileset fetch (`ensureTileset` / `syncTileset`).
2. `src/play/launcher.js`: `launchPlaytest(parsed, legend, tileset)`;
   forward `tileset` to `new PlaytestScene(game, parsed, legend,
   tileset, exit)`.
3. `src/play/playtestScene.js`: constructor accepts and stores
   `tileset`. **No `draw()` change yet** — the old vendored-entity
   draws still run.
4. `src/renderer.js`: convert the internal `drawFallback` to an
   exported function (signature unchanged: `drawFallback(ctx, glyph,
   x, y, t)`). The renderer test suite stays green (it imports `draw`
   only).
5. Smoke: open the live editor, press Play; playtest looks
   identical to v13 (no rendering change yet, the wire-through is
   silent).

Commit: `v14 m1: wire tileset through to PlaytestScene; export drawFallback`.

## Milestone 2 — `draw()` delegates to the editor renderer

1. `src/play/playtestScene.js`:
   - `import { draw as editorDraw, drawFallback } from '../renderer.js';`
   - New pure helper `buildViewGrid({ grid, player, coins, playerChar })`
     returning a fresh `string[]` of the same shape with:
     - The player's spawn cell (derived from `player.x/TILE`,
       `player.y/TILE` at restart-time — store this once in
       `restart()` as `this.spawnRC`) replaced by `.`.
     - Every collected coin's cell (`coin.x/TILE`, `coin.y/TILE`)
       replaced by `.`.
     - Untouched cells preserved character-for-character.
   - `restart()` stores `this.playerChar` — looked up from
     `legend` as the first char whose role is `player`; falls back
     to `'P'` if (somehow) absent so the gate ought to have caught
     it already.
   - `draw(ctx)`:
     - `editorDraw(ctx, { grid: buildViewGrid({...}), meta:
       this.parsed.meta }, this.tileset, TILE_EDITOR)` — where
       `TILE_EDITOR` is the engine's `TILE` (20 px). The renderer
       resizes the canvas to the right intrinsic dims; the launcher's
       initial size (already `worldW × worldH`) matches.
     - **Player overlay**: try `this.tileset?.entityFor?.(this.playerChar)`
       → a draw spec. If present, `ctx.drawImage(spec.image, spec.sx,
       spec.sy, spec.sw, spec.sh, Math.round(this.player.x),
       Math.round(this.player.y), TILE, TILE)`. Else call the
       newly-exported `drawFallback(ctx, this.playerChar,
       Math.round(this.player.x), Math.round(this.player.y), TILE)`.
     - **HUD + banner** drawn last, identical to today.
2. `src/play/playtestScene.test.js`:
   - `buildViewGrid`: player cell cleared; multiple collected coins
     cleared; uncollected coins kept; spikes/exits/decorations
     untouched; identical layout when nothing is collected and the
     player is at the spawn cell.

Commit: `v14 m2: playtest draw via editor renderer + player overlay (tested)`.

## Milestone 3 — Playwright proof + transcript + Delivered

1. `tests/playtest-tileset.spec.js`:
   - Load the editor, switch to **PlayWithYourPeas**, paste a
     small test level (one P, one E, one o; no spikes), press
     Ctrl/Cmd+Enter to launch playtest, screenshot the playtest
     canvas.
   - Switch to **Dirt**, paste the same level, launch, screenshot.
   - md5 the two — they must be **different** (the canvas pixels
     differ; PWYP shows Pea/Flag/Happy point, Dirt shows
     autotiled dirt + shape entities).
   - For an extra safety net: assert PWYP playtest hash ≠ v13's
     PWYP *preview* hash AND the v13 Dirt playtest hash (i.e. the
     screenshot moved with the tileset, not with the level).
2. The existing v10 distinctness assertion across editor previews
   stays untouched and green.
3. `TDDs/3_transcripts/version14_build.md`; mark design + impl
   Delivered.

Commit: `v14 m3: playwright playtest-by-tileset spec + v14 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is structural only** — wires + an export. No behaviour
  change. The renderer test suite catches accidental export
  regressions.
- **M2 is the only behavioural change.** Risk: a Dirt subtle pixel
  diff in playtest vs the editor preview — they should now match
  byte-for-byte (modulo the moving player). The visible-on-deploy
  acceptance criterion is "Dirt playtest looks like Dirt editor
  preview, plus a continuously-moving player".
- **`buildViewGrid` per frame is O(grid)** — a 24×10 tutorial =
  240 cells per frame * 60 fps = 14,400 string-builds per second.
  Cheap on modern hardware; the editor renderer already does
  O(grid) work per draw call.
- **Player char lookup** runs once at `restart()`. The legend
  scan is O(legend) ≈ 6 entries. Negligible.
- **No deploy risk** — bundle grows by a small wiring layer; Pages
  workflow unchanged.

## Deferred (design §9 → v15)

Animated playback over time; state-changing exit (`imageActive`);
multi-row tile atlas support; procedural-decor data in the lookup;
cleanup of the now-unused vendored entity `.draw()` methods +
`public/play-assets/` (still loaded by the launcher but never
displayed); keyboard nudge on the splitters.
