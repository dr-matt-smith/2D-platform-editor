# Version 19 — Implementation Plan

Status: **Delivered (M1–M6)** · Date: 2026-05-21 · Design:
[../1_design/version19_design.md](../1_design/version19_design.md) ·
Transcript: [../3_transcripts/version19_build.md](../3_transcripts/version19_build.md)

Delivered, one path-scoped commit per milestone (the user's in-flight
`fred.txt` / `above_ground2.txt` / `manifest.json` /
`__temp/wish_list.md` stayed out throughout; M4 inadvertently
bundled the user's IncaTiles tileset draft (5 files) which the IDE
had pre-staged — user chose to leave the bundle as-is; M5 caught a
similar SynnyLand pre-stage and un-staged it cleanly — see the
v19 transcript for the post-mortem):

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `5bd8145` | `level.js`: `meta.viewport` field, `# viewport: WxH \| fit` parse/serialize with [4, 200] clamp; `setViewportDirective` pure helper; 19 new unit cases including coexistence with the v18 directives |
| 2 | `5b8edce` | new pure `src/playtestCamera.js` — `centerCamera()` + `computeCamera()` (40% × 33% dead-zone defaults, world-edge clamp); 14 unit cases including a purity assertion |
| 3 | `b560b10` | `renderer.js` `draw()` gains optional trailing `camera` arg; camera=null is byte-identical to v18; when set: canvas → viewport, `ctx.save/translate/restore` brackets world drawing, 6 cell loops cull to visible band + 1-cell bleed; 6 new test cases |
| 4 | `6e2937e` | `launcher.js` sizes canvas to viewport when set; `playtestScene.js` adds `camX/camY` + spawn-init + per-frame `computeCamera` + player-overlay shift; `#banner` reads canvas dims; `main.js` CSS-pin reads viewport.w when set |
| 5 | `06bfac1` | `openPlaySettings()` gains a Viewport group above the Pickup group; save returns `{ pickupRequired, viewport }`; `main.js` chains both setters through one `applyEdit` (single undo step) |
| 6 | _this commit_ | `tests/playtest-scroll.spec.js` (40-wide world, 16x10 viewport, walk right, intrinsic stable + hash changes); v19 transcript; design + impl Delivered |

Outcome: 178 → 217 unit tests (+39: 19 schema, 14 camera, 6
renderer-camera), Playwright 5 → 6 (new scroll spec; the v18 size-
probe + the four pre-v19 specs unchanged). Both builds clean. The
v9 §7 byte-identical-to-upstream invariant for `src/play/`
vendored files preserved across all six commits.

Six small path-scoped commits. The two design changes — scrolling
playtest + Viewport Play Setting — split cleanly along
schema → camera-math → renderer → playtest-wiring → settings → docs
lines, so each milestone can land independently and roll back on
its own.

## Process (same discipline as v8–v18)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` /
  PWYP `sources.txt` stay out.
- **The v9 §7 byte-identical-to-upstream invariant for `src/play/`
  vendored files is preserved.** v19 only touches `playtestScene.js`
  + `launcher.js` (v9-original glue) and adds a new pure
  `playtestCamera.js`; the vendored `core/` + `entities/` stay byte-
  identical.

## Constraints & approach

- **Back-compat is the gate** at every milestone:
  - Levels without `# viewport:` (i.e. every pre-v19 level) play
    in fit mode — the v18 behaviour, byte-identical.
  - `editorDraw(ctx, parsed, tileset, TILE, now)` (no camera arg)
    is byte-identical to v18 — the existing call sites (editor
    `run()`, fit-mode playtest) never pass a camera and never see
    a new code path.
  - The Play Settings dialog without a viewport (its default state)
    writes nothing new; v18 levels round-trip clean.
- **Pure helpers for the new logic** — both the camera math and
  the directive setter live as small exported functions so
  `node --test` covers them DOM-free.
- **The renderer signature change is additive.** `camera` is an
  optional trailing parameter; omitting it preserves v18 behaviour
  to the byte.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/level.js` | `parse` reads `# viewport: WxH` (or `fit`/absent) → `meta.viewport` (`null` or `{w,h}`); `serialize` round-trips when non-null; `setViewportDirective(text, value)` pure helper mirrors `setPickupRequiredDirective` | M1 |
| `src/level.v19.test.js` (new) | parse/serialize round-trip cases; `fit` ↔ absent equivalence; clamp out-of-range; setter cases | M1 |
| `src/playtestCamera.js` (new, pure) | `computeCamera(player, prev, viewport, world)` — dead-zone math returning a new `{camX, camY}`; `centerCamera(player, viewport, world)` for the spawn-init path | M2 |
| `src/playtestCamera.test.js` (new) | player-inside-dead-zone → unchanged camera; player crosses each edge → camera shifts by the overshoot; world-edge clamp on all four sides; world smaller than viewport → camera = 0; spawn-center clamps correctly | M2 |
| `src/renderer.js` | `draw()` gains optional `camera = null` trailing param; when non-null, canvas sized to viewport, ctx translated by `-Math.round(camX/Y)`, cell iteration clipped to `[camCol, camCol+viewCols+1) × [camRow, camRow+viewRows+1)`; when null, byte-identical | M3 |
| `src/renderer.test.js` | new cases: camera translate verified via stub `ctx.translate` recorder; cell-cull skips out-of-view; fit-mode (camera=null) byte-identical to v18 baseline | M3 |
| `src/play/launcher.js` | reads `parsed.meta.viewport`; canvas sized to viewport dims when set, world dims when null (current v18 behaviour) | M4 |
| `src/play/playtestScene.js` | new `camX`/`camY` state + `viewport`/`viewportW`/`viewportH` fields; `restart()` centers camera on spawn via `centerCamera`; `update()` calls `computeCamera` after `player.update`; `draw()` passes `camera` to `editorDraw` and draws player overlay at `(x-camX, y-camY)`; HUD + banner moved to screen-space coords | M4 |
| `src/main.js` (CSS pin) | the v18-hotfix CSS pin updates to read `parsed.meta.viewport?.w ?? parsed.meta.width` × editor TILE | M4 |
| `src/loaderDialog.js` | `openPlaySettings` gains a Viewport group above the existing Pickup group: radio Fit / radio Window with W×H number inputs; the save callback now returns `{ pickupRequired, viewport }` | M5 |
| `src/main.js` (Play Settings handler) | the click handler updates to write **both** directives via `setPickupRequiredDirective` + `setViewportDirective`, each going through `applyEdit` as a single combined edit (history step) | M5 |
| `tests/playtest-scroll.spec.js` (new) | Playwright: paint a 40×16 level with `# viewport: 20x10` directly into `src.value`; press Play; inject a series of right-arrow keypresses for ~40 frames; assert canvas intrinsic stays `20*TILE × 10*TILE` AND the visible content hash changes between the early and late frames (proves the camera scrolls) | M6 |
| `TDDs/3_transcripts/version19_build.md` (new) | narrative, v8–v18 style | M6 |

## Milestone 1 — Schema parser + setter (pure, tested)

1. `src/level.js`:
   - `parse()` adds a clause to the directive switch:
     - `# viewport: fit` → `meta.viewport = null` (explicit fit).
     - `# viewport: <W>x<H>` (case-insensitive `x`) → `meta.viewport
       = { w: clamp(W), h: clamp(H) }` where `clamp` is the existing
       4–200 helper.
     - Anything else → `meta.viewport = null` + a parse warning
       (the existing issues channel).
   - `serialize()` emits `# viewport: WxH` when `meta.viewport`
     is non-null (mirrors `# pickup-required:` emission order —
     after `# tileset:`, before the grid).
   - `setViewportDirective(text, value)` — pure; `value` is
     `null` / `'fit'` (both remove the directive) or `{w, h}`.
     Uses the shared `setHeaderDirective` helper.
2. `src/level.v19.test.js`: parse/serialize round-trip, `fit` ↔
   absent equivalence, clamp out-of-range, setter cases (add /
   update / remove).
3. **No behaviour change** in the editor / renderer / playtest
   yet — the new `meta.viewport` field is declared but
   unconsumed.

Commit: `v19 m1: schema — # viewport: directive + setter (tested)`.

## Milestone 2 — Pure camera math

1. `src/playtestCamera.js`:
   - `centerCamera(playerCenter, viewport, world)` → `{camX,
     camY}` — places the player at the viewport center then
     world-clamps. Used by `restart()`.
   - `computeCamera(playerCenter, prev, viewport, world)` →
     `{camX, camY}` — dead-zone math from design §4.2; world-
     clamps before return.
   - Both helpers are pure; they accept primitives and return a
     fresh object. `viewport = { w, h }` and `world = { w, h }`
     in world pixels.
2. `src/playtestCamera.test.js`: ~10 cases:
   - Spawn at world center, viewport smaller → camera centers.
   - Spawn near world edge → camera clamps.
   - Player inside dead-zone → camera unchanged.
   - Player crosses each of the 4 dead-zone edges → camera
     shifts by exactly the overshoot.
   - World ≤ viewport on either axis → camera = 0 on that axis.
   - Player at world edge → camera at world-viewport boundary,
     not past.
3. **No behaviour change in the running editor yet** — the
   helpers are declared but not imported.

Commit: `v19 m2: playtestCamera.js — dead-zone follow + spawn center (tested)`.

## Milestone 3 — Renderer camera support

1. `src/renderer.js`:
   - `draw(ctx, parsed, tileset, tile = TILE, now = 0, camera =
     null)`.
   - Branch on `camera`:
     - `null` (today's path): canvas sized to world (`gridW *
       tile, gridH * tile`); iterate all cells; same passes 0a /
       1 / 2 / 3 / 4a / 4b / 4c as v18. **Byte-identical**.
     - non-null `{camX, camY, viewW, viewH}`:
       - Canvas sized to `(viewW, viewH)`.
       - `ctx.save(); ctx.translate(-Math.round(camX),
         -Math.round(camY));`
       - Compute `camCol = Math.floor(camX / tile)` etc.; iterate
         only the visible band of cells; the existing pass
         structure runs over that subset.
       - `ctx.restore()` after the world is painted; HUD-style
         overlays from the caller paint in screen space.
2. `src/renderer.test.js`: new cases:
   - Stub `ctx.translate` recorder asserts a single translate
     call to `(-Math.round(camX), -Math.round(camY))` after a
     pre-translate baseline.
   - `drawImage` call count for a 40×16 world with a 20×10
     viewport is ≤ ~250 (not ~640+).
   - Camera-null path: total drawImage calls match the v18
     baseline byte-for-byte.
3. **Visible after this commit**: nothing yet — the renderer
   accepts a camera but no caller passes one.

Commit: `v19 m3: renderer.js — optional camera param (translate + cell-cull)`.

## Milestone 4 — PlaytestScene wiring + launcher

1. `src/play/playtestScene.js`:
   - Constructor stores `viewport = parsed.meta.viewport`.
   - `restart()` initialises `camX/camY` via `centerCamera(...)`.
     If `viewport` is null, leaves them at `(0, 0)` (fit mode —
     the renderer's camera-null path means they're unused).
   - `update()` calls `computeCamera(...)` after the existing
     `player.update(dt, this)` line.
   - `draw()`:
     - Build the camera object only if `viewport` is non-null,
       else `null`; pass to `editorDraw`.
     - Player overlay: `const ox = Math.round(this.player.x -
       this.camX); const oy = Math.round(this.player.y -
       this.camY);` (fit mode: camX/Y are 0 so this is
       identical to today).
     - HUD: drawn in screen coords (translate is already
       reset by editorDraw). For windowed mode, the existing
       `ctx.fillText(hud, 8, 8)` is correct as-is.
     - `#banner` math: in windowed mode, `cx = viewW / 2; cy =
       viewH / 2` (currently `worldW / 2` / `worldH / 2`). Use
       the canvas dims instead (`ctx.canvas.width / 2` etc.) so
       the same code works in both modes.
2. `src/play/launcher.js`:
   - Read `viewport = parsed.meta.viewport`.
   - `const dims = viewport ? { worldW: viewport.w * TILE,
     worldH: viewport.h * TILE } : toWorld(parsed, legend);` —
     the canvas intrinsic dims for `canvas.width / height`.
3. `src/main.js` (CSS pin):
   - In `tryPlaytest()`, the `previewCanvas.style.width = ...`
     pin reads `(parsed.meta.viewport?.w ?? parsed.meta.width) *
     TILE`.
4. **Visible after this commit**: setting `# viewport: 20x12`
   in the buffer (via the textarea, since the dialog row isn't
   in yet) → press Play → camera scrolls. Pre-v19 levels still
   play in fit mode.

Commit: `v19 m4: PlaytestScene camera + launcher viewport sizing`.

## Milestone 5 — Play Settings dialog row + wiring

1. `src/loaderDialog.js`:
   - `openPlaySettings({ pickupRequired, viewport, total, onSave,
     onCancel })` (signature gains `viewport`).
   - New "Viewport (camera in play mode)" group above the
     existing Pickup group:
     - Radio "Fit whole level (default) — no scrolling".
     - Radio "Window: [W] × [H] cells" with two `<input
       type="number" min="4" max="200">` boxes.
     - Focusing either number input auto-selects the "Window"
       radio (mirrors the v18 ps-n pattern).
   - `readValue()` returns `{ pickupRequired, viewport }` (the
     latter is `null` for fit, `{w, h}` for window).
   - Save → `onSave({ pickupRequired, viewport })`.
2. `src/main.js`:
   - The Play Settings click handler updates:
     ```js
     openPlaySettings({
       pickupRequired: parsed.meta.pickupRequired ?? 'all',
       viewport: parsed.meta.viewport,
       total,
       onSave: ({ pickupRequired, viewport }) => {
         let next = src.value;
         next = setPickupRequiredDirective(next, pickupRequired);
         next = setViewportDirective(next, viewport);
         if (next !== src.value) applyEdit(next);
       },
     });
     ```
   - Both directive writes go through a single `applyEdit` call
     so the undo step covers them as one unit.
3. **Visible after this commit**: the Play Settings button
   opens a dialog with two groups; saving writes both
   directives; the playtest honours them.

Commit: `v19 m5: Play Settings — Viewport row + dual-directive save`.

## Milestone 6 — Scroll e2e + docs + Delivered

1. `tests/playtest-scroll.spec.js`:
   - Paint a 40×16 level with `# viewport: 20x10` directly into
     `src.value` (via `page.evaluate`).
   - Press Play; wait for `body.classList.contains('playmode')`.
   - Snapshot the canvas (intrinsic dims + a hash of the
     rendered pixels).
   - Inject 40 right-arrow keypress frames via the same Input
     injection pattern used by `playtest-animation.spec.js`.
   - Snapshot again. Assert: intrinsic dims unchanged; pixel
     hash differs (the world has scrolled into view).
2. `TDDs/3_transcripts/version19_build.md` (new): narrative;
   the architectural choices (camera as PlaytestScene state,
   not vendored; the `editorDraw` optional camera trailing arg
   over the cleaner-but-bigger offscreen-canvas approach; the
   dead-zone math broken out as a pure helper for `node --test`
   coverage); the renderer cell-cull perf note; the fit-mode
   back-compat invariant.
3. Mark design + impl Delivered with the M1–M6 commit-hash
   table.

Commit: `v19 m6: playwright scroll spec + v19 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is pure + parse-side only.** No behaviour change in the
  running editor. The new field is declared but unconsumed.
- **M2 is pure + standalone.** The camera helpers don't import
  anything from the engine or the DOM; `node --test` runs them
  with primitive inputs.
- **M3 is the renderer signature change.** Risk: a subtle pixel
  diff in the camera-null (today's) path. Mitigation: the v18
  renderer tests are the back-stop; the camera-null branch is
  intentionally `if (!camera) { …today's code… }` with no
  refactoring of the inner passes.
- **M4 wires the live behaviour.** Risk: an in-place
  `playtestScene.js` regression breaks the v14/v16/v18 e2e
  specs. Mitigation: all the fit-mode code paths (camera = null
  branch) stay structurally identical to v18; the `#banner`
  switch from `worldW/2` to `ctx.canvas.width/2` is the one
  surgical change that affects fit-mode rendering, and the v18
  baseline gives `worldW === ctx.canvas.width` so the pixel
  output is the same.
- **M5 is dialog-shape change.** Risk: an existing automated
  test of the v18 Play Settings dialog flow breaks. There
  isn't one (the v18 Play Settings is tested by the unit suite
  on `meetsPickupRequirement` + the directive setter, not the
  modal), so this is low.
- **M6 adds an e2e spec.** The Playwright suite grows 5 → 6.
- **No deploy risk.** Bundle grows by ~1KB; Pages workflow
  unchanged.

## Deferred (design §9 → v20+)

- **Damped camera follow** — exponential ease toward target.
- **Look-ahead camera** — directional bias.
- **Vertical lock to ground** — Mario-style Y discipline.
- **Author-configurable dead-zone** — Play Settings sub-row.
- **Auto-viewport** — compute from canvas-wrap dimensions.
- **Per-tileset default viewport** — declared in lookup.
- **Camera shake** — impacts, deaths.
- **Parallax for background images** — scroll factor < 1.
- **Multi-screen camera transitions** — Zelda snap.
- **Decoration-image free placement** — v18 schema, v20+ model.
- **Layered z-order with named layers** — long-standing.
- **Cleanup of dead-end `caretLineCol` / `updateCursor`
  helpers** (v17 leftover) — still pending.
- **Per-cell animation phase offset** (v16 §8) — long-standing.
- **Pause-aware animation** — long-standing.
- **Multi-row tile atlases** (Treasure Hunters 17×5) — long-
  standing.
- **State-changing exit** (`imageActive`) — long-standing.
