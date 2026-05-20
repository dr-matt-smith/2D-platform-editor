# Version 16 — Implementation Plan

Status: **Delivered (M1–M3)** · Date: 2026-05-21 · Design:
[../1_design/version16_design.md](../1_design/version16_design.md) ·
Transcript: [../3_transcripts/version16_build.md](../3_transcripts/version16_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `363b9c4` | `buildSpec` returns static spec OR `(now) → spec` animator; `fps` field; `resolve()` helper; accessors gain optional `now`; 131 → 138 tests |
| 2 | `a1e3000` | `draw(ctx, parsed, tileset, tile, now)` forwards `now` to all three accessor calls; `PlaytestScene.draw` passes `performance.now()`; 138 → 140 tests |
| 3 | _this commit_ | `tests/playtest-animation.spec.js` (PA1 playtest changes over 400 ms); v16 transcript; design + impl Delivered |

Outcome: 131 → 140 unit tests (+9), Playwright 11 → 12 (+1
animation smoke). Both builds clean. Pixel Adventure 1's Mask Dude
and Apple sheets now cycle live in playtest at the default 10 fps,
with zero `tile_lookup.json` edits.

A single focused feature: cycle multi-frame sprite sheets over time
during playtest. Three small path-scoped commits.

## Process (same discipline as v8–v15)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- Pure parts unit-tested under `node --test`; the visible animation
  is Playwright-tested as a smoke check (the precise frame timing is
  asserted in the unit tests, not e2e).

## Constraints & approach

- **Back-compat is the gate.** Every existing test calls accessors
  *without* `now`; that path must keep resolving to frame 0
  (identical to v15). The animator function returns frame 0 when
  called with `now = undefined` (via `now ?? 0` inside).
- **No editor preview change.** The editor calls
  `draw(ctx, parsed, tileset, TILE)` (no fifth arg); the preview
  stays static. Only `playtestScene.draw` adds
  `performance.now()`.
- **Pure functions for animation.** Animated entries are stored as
  `(now) → spec` functions; static entries stay as pre-computed
  spec objects. The accessor is one line — call the function if
  needed, return the spec.
- **No `tile_lookup.json` changes.** Pixel Adventure 1's existing
  `frames: 11` (Mask Dude) and `frames: 17` (Apple) animate
  automatically once v16 ships, with the schema default `fps: 10`.

## Module map

| File | Change |
|------|--------|
| `src/tileset.js` | `buildSpec` returns either a static spec or a `(now) → spec` function per design §4–§5; new optional `fps` field per glyph; accessors `terrainFor` / `entityFor` / `decorationFor` accept optional `now` and call the function entry if any |
| `src/tileset.test.js` | new unit cases for the §4 truth table (frames=1 static; frames>1 + explicit `frame` static; frames>1 default animates at 10 fps; explicit `fps: 0` static; out-of-range frame still clamped) |
| `src/renderer.js` | `draw(ctx, parsed, tileset, tile, now)` — fifth arg optional; forwarded to `terrainFor` / `entityFor` / `decorationFor` |
| `src/renderer.test.js` | one new case: a tileset stub whose `entityFor(char, now)` returns different specs for different `now` makes the renderer call `drawImage` with different `sx` (proves the renderer carries `now` through to the spec) |
| `src/play/playtestScene.js` | one-line change — `editorDraw(..., TILE, performance.now())` and the player-overlay `entityFor(this.playerChar, performance.now())` |
| `tests/playtest-animation.spec.js` (new) | smoke spec: open the Pixel Adventure 1 playtest, screenshot, wait ~400 ms (≥ 4 frames at the default 10 fps), screenshot again, assert the two PNG md5s differ |
| All `tile_lookup.json` files | **unchanged** |

## Milestone 1 — tileset.js: animator + schema + tests

1. `src/tileset.js`:
   - Replace the current `buildSpec(image, framesField, frameField)`
     with one that also reads `fpsField`:
     - `frames === 1` (default) → return the same static spec as
       v15.
     - `frames > 1` and `frameField != null` → static, frozen at
       `clamp(frame, 0, frames-1)` — v11 author override.
     - `frames > 1` and `frameField == null` and `fps == 0` →
       static at frame 0 (explicit opt-out).
     - `frames > 1` and `frameField == null` and `fps > 0` → return
       `(now) => spec` where
       `frame = Math.floor((now ?? 0) * fps / 1000) % frames`.
     - Default `fps = 10` when omitted and `frames > 1`.
   - Accessors:
     - `terrainFor(mask, now)` / `entityFor(char, now)` /
       `decorationFor(char, now)` — each calls the entry as a
       function with `now` when it's a function; returns the
       static spec otherwise. `now` itself is optional;
       `entry(undefined)` → `entry(0)` inside the animator →
       frame 0.
2. `src/tileset.test.js`:
   - **All existing v11 tests pass unchanged** — they call
     `entityFor(char)` (no `now`); animated entries resolve to
     frame 0, so `.sx === 0` still holds.
   - Add new cases:
     - `frames: 11, no frame, no fps` → at `now=0` sx=0; at
       `now=100` (10 fps → 100ms = 1 frame) sx=sw; at
       `now=1100` (10 fps → 11 frames; mod 11 → frame 0) sx=0.
     - `frames: 11, frame: 5, no fps` → static at frame 5
       regardless of `now`.
     - `frames: 11, no frame, fps: 0` → static at frame 0
       regardless of `now`.
     - `frames: 4, no frame, fps: 25` → at `now=40` (25 fps →
       40ms = 1 frame) sx=sw.

Commit: `v16 m1: tileset animator + fps field (tested)`.

## Milestone 2 — renderer + playtest plumbing

1. `src/renderer.js`:
   - `draw(ctx, parsed, tileset, tile = 24, now)` — fifth arg
     optional.
   - Pass `now` to `terrainFor`, `entityFor`, `decorationFor` in
     their three call sites.
2. `src/renderer.test.js`:
   - Existing tests pass unchanged — they call `draw(...)` without
     `now`, and the fakeTileset returns static specs unconditionally
     (animation is opaque to it).
   - Add one v16 case with a fakeTileset whose `entityFor(char, now)`
     returns a spec with `sx = now`, asserting that the renderer
     forwarded `now` correctly (via the captured `drawImage` args).
3. `src/play/playtestScene.js`:
   - `draw(ctx)`: change the editor-draw call to
     `editorDraw(ctx, viewParsed, this.tileset, TILE,
     performance.now())`.
   - The player overlay's spec lookup: `this.tileset?.entityFor?.(
     this.playerChar, performance.now())`.
   - **No other change** — buildViewGrid, HUD, banner unchanged.

Commit: `v16 m2: renderer + playtest pass now through to accessors`.

## Milestone 3 — Playwright animation smoke + transcript + Delivered

1. `tests/playtest-animation.spec.js`:
   - Open the editor; switch to **Pixel Adventure 1**; wait for the
     tileset-ready hook (`window.__activeTileset`, v14).
   - Launch playtest (Ctrl+Enter); wait for `.playtest canvas`.
   - **Screenshot S0** of the playtest canvas.
   - `await page.waitForTimeout(400)` — at 10 fps, ≥ 4 frames have
     advanced; even if the player has barely moved (or has stopped
     on the floor), Mask Dude / Apple cycles are guaranteed to
     differ.
   - **Screenshot S1** of the playtest canvas.
   - Assert `md5(S0) !== md5(S1)`. (The assertion proves the
     canvas is **dynamic over time** — animation contributes to the
     diff. The precise per-frame `sx` math is asserted in the M1
     unit tests, which is where deterministic assertions belong.)
   - Esc to close.
2. Existing `tests/playtest-tileset.spec.js` (the Dirt ≠ PWYP
   distinctness spec) **stays untouched** — it's about per-tileset
   art, not over-time motion.
3. `TDDs/3_transcripts/version16_build.md`; mark design + impl
   Delivered with hashes.

Commit: `v16 m3: playwright animation smoke + v16 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is pure** — schema + animator + unit tests. Every existing
  test passes unchanged because the v15 default behaviour ("no
  `now` → frame 0") is preserved.
- **M2 is the only behavioural change.** The renderer signature
  grows an optional arg; the editor preview doesn't pass it, the
  playtest does. The only place "what does the canvas look like
  right now" depends on time is the playtest, by design.
- **The Playwright animation smoke is a smoke check, not an
  isolated animation assertion.** Player physics also evolve over
  400 ms, so two screenshots will always differ if anything moves.
  Combined with M1's deterministic per-frame `sx` unit tests, the
  total proof is sufficient: animator math correct (unit) +
  playtest renders dynamically over time (e2e).
- **Per-frame draw cost.** The animator allocates a fresh spec
  object per call. At 60 Hz × ~20 entity cells per level, that's
  ~1200 small allocations per second — negligible GC pressure.
- **`performance.now()` resolution.** Sub-millisecond; far finer
  than the 100 ms-per-frame default. Animator's `Math.floor`
  guarantees integer frame indices.
- **No deploy risk.** Bundle grows by a few dozen bytes (animator
  closure + the fifth arg in two function signatures); Pages
  workflow unchanged.

## Deferred (design §12 → v17+)

- **Per-cell phase offset** — would make groups of identical glyphs
  feel less mechanical.
- **Pause-aware animation** — game-time accumulator that freezes
  during win/lose banners. Pairs with a real pause feature.
- **Multi-row atlases** (Treasure Hunters palm-terrain 17×5) —
  needs a `frames: { cols, rows }` schema + a 2D index in the
  renderer.
- **Editor-preview animation** behind an opt-in toggle.
- **State-changing exit** (`imageActive`) — carry-over candidate.
- **Keyboard nudge** on the v12/v13 splitters — carry-over polish.
