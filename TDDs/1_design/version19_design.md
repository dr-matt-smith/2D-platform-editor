# 2D Level Designer — Version 19 Design Document

Status: **Delivered** · Date: 2026-05-21 · Builds on:
[version18_design.md](version18_design.md) (legend cleanup,
background/decoration images, play-in-place, Play Settings) ·
Implementation:
[../2_implementation/version19_implementation.md](../2_implementation/version19_implementation.md) ·
Transcript:
[../3_transcripts/version19_build.md](../3_transcripts/version19_build.md)

## 1. Purpose

Make **big levels playable**. v18 made the editor canvas the play
surface (`play-in-place`); v19 makes that surface **track the
player** with a scrolling camera so a level wider than the
viewport remains usable instead of being CSS-shrunk into a
microscope view.

Concretely:

1. **Scrolling playtest** — a dead-zone camera follows the player
   in play mode. The level's full grid is the world; the canvas
   shows a viewport-sized window onto it. Camera clamps at world
   edges (small levels stay pinned; large levels scroll).
2. **Viewport Play Setting** — a new row in the v18 Play Settings
   dialog: `Viewport: <W>×<H> cells` (default 20×12, alongside a
   "Fit whole level" option that preserves the v18 default). The
   author's choice writes a `# viewport: WxH` directive into the
   buffer.
3. **Edit mode stays bird's-eye** — the editor preview continues
   to show the entire level at once. The viewport rectangle is
   purely a *play-time* concept; v19 does not change anything an
   author sees while editing.

The level format / playtest physics / tileset accessors are
preserved. v19 adds one directive (`# viewport:`), one
PlaytestScene camera, and one Play Settings row.

## 2. Current state

- **Playtest canvas size**: today the v18 launcher resizes
  `#preview` to `(gridW × engineTILE, gridH × engineTILE)` — the
  **whole world**. The CSS pin from the v18 hotfix scales display
  to the editor's intrinsic (`gridW × editorTILE`). Big levels
  exceed the wrap; `max-width: 100%` then shrinks them, so a
  40×20 level CSS-scales to fit and becomes hard to play.
- **PlaytestScene.draw()** delegates to `editorDraw(ctx, parsed,
  tileset, TILE, now)` — the v14 single-source-of-pixel-truth
  decision. The player overlay is drawn on top in world coords.
- **Camera**: none. The view is the whole world.
- **Play Settings dialog**: one row (pickup requirement).

## 3. Schema additions

### 3.1  `# viewport:` directive

A new optional header directive:

```
# viewport: WxH
```

Where `W` and `H` are positive integers (clamped server-side to
`[4, 200]`, same as the level-size clamp from v8).

Special values:

- **Absent** → "fit whole level" — back-compat with v18; the
  playtest canvas sizes to the entire world (today's behaviour).
- **`# viewport: fit`** → explicit "fit whole level" (same as
  absent, just legible).
- **`# viewport: 20x12`** → the playtest canvas shows a 20×12
  cell window and scrolls as the player moves.

`parse()` reads the directive into `meta.viewport`, with shape:

```js
meta.viewport = null               // absent / "fit" → entire world
meta.viewport = { w: 20, h: 12 }   // explicit cell dims
```

`serialize()` emits the directive when non-null (mirrors
`# background-image:` / `# pickup-required:` from v18). A pure
helper `setViewportDirective(text, value)` mirrors v18's
`setPickupRequiredDirective`.

### 3.2  No tileset schema change

The viewport is a per-level concept (different levels can ship
different viewports); it lives in the buffer, not in the tileset
lookup. v20+ could allow a tileset to declare a *preferred*
viewport (e.g. "this 16×9-friendly tileset suggests 20×12") but
that's not v19.

## 4. UX changes in detail

### 4.1  Play Settings — new "Viewport" row

The v18 dialog gains one row above the existing pickup-requirement
group:

```
Viewport (camera in play mode)
  (•) Fit whole level (default) — no scrolling
  ( ) Window:  [_20_] × [_12_]  cells

Pickup requirement — what does the player need to collect before
the exit ends the level?
  (•) All pickups required (default)
  ( ) At least  [_3_]  pickups
  ( ) No minimum — touching the exit wins
                                       [ Cancel ]  [ Save ]
```

"Save" writes (or removes) `# viewport:` via the pure setter then
`applyEdit` — a normal undo step.

### 4.2  Camera behaviour — dead-zone follow

The camera state is two world-pixel coordinates `(camX, camY)`
on `PlaytestScene`. A **dead-zone** rectangle (centered in the
viewport, 40% wide × 33% tall) defines the region inside which
the player can move without the camera tracking; once the player
crosses the dead-zone edge the camera nudges to bring them back
inside.

Pseudocode:

```js
update(dt) {
  …                                  // existing player.update etc
  this.#updateCamera();
}

#updateCamera() {
  const vw = this.viewportW;         // px (viewportCells.w * TILE)
  const vh = this.viewportH;
  const dzW = vw * 0.4;               // dead-zone dims
  const dzH = vh * 0.33;
  const dzL = this.camX + (vw - dzW) / 2;
  const dzR = dzL + dzW;
  const dzT = this.camY + (vh - dzH) / 2;
  const dzB = dzT + dzH;
  if (this.player.x < dzL) this.camX -= dzL - this.player.x;
  if (this.player.x > dzR) this.camX += this.player.x - dzR;
  if (this.player.y < dzT) this.camY -= dzT - this.player.y;
  if (this.player.y > dzB) this.camY += this.player.y - dzB;
  // World-edge clamp: pinned at 0 when world is smaller than the
  // viewport, otherwise stops at (world - viewport).
  this.camX = Math.max(0, Math.min(this.camX, Math.max(0, this.worldW - vw)));
  this.camY = Math.max(0, Math.min(this.camY, Math.max(0, this.worldH - vh)));
}
```

On `restart()` the camera resets to center on the player spawn
(clamped to world edges).

### 4.3  Renderer integration

`editorDraw()` gains an optional camera parameter:

```js
draw(ctx, parsed, tileset, tile = TILE, now = 0, camera = null)
```

When `camera` is `null` (editor preview, fit-mode playtest), the
function behaves byte-identically to v18 — paints the whole
world.

When `camera = { camX, camY, viewW, viewH }`:

- The canvas is assumed to be sized to `(viewW, viewH)` by the
  caller. The renderer sets `ctx.canvas.width / height` to those.
- Before painting, `ctx.translate(-Math.round(camera.camX),
  -Math.round(camera.camY))` shifts world coords into viewport
  coords.
- Cell iteration is **clipped** to the visible range
  `[camCol, camCol + viewCols + 1) × [camRow, camRow + viewRows
  + 1)` — the `+1` accounts for partial-tile bleed at the edges.
  This is the perf win: a 60×40 world doesn't iterate 2400 cells
  per frame, just ~250 for a 20×12 viewport.
- After painting the world, the translate is reset; HUD overlays
  drawn by `PlaytestScene` paint in screen coords (so the score
  readout doesn't scroll off-screen).

`PlaytestScene.draw()` passes the camera object on every frame:

```js
editorDraw(
  ctx,
  { grid: viewGrid, meta: this.parsed.meta, rows: this.parsed.rows },
  this.tileset,
  TILE,
  now,
  this.viewport
    ? { camX: this.camX, camY: this.camY, viewW: this.viewportW, viewH: this.viewportH }
    : null,
);
```

Then the player overlay is drawn at `(player.x - camX, player.y -
camY)` so it tracks the world.

### 4.4  Canvas sizing in play mode

The v18 launcher resizes the canvas to world dims; v19 splits on
viewport mode:

| Mode | Canvas intrinsic | CSS display |
|---|---|---|
| fit (default) | `worldW × worldH` (gridW × engineTILE, gridH × engineTILE) | `gridW × editorTILE` (the v18 hotfix pin) |
| windowed (`# viewport: WxH`) | `W × engineTILE`, `H × engineTILE` | `W × editorTILE` |

So a 20×12 viewport: canvas is 400×240 intrinsic, displayed at
480×288 CSS pixels. A 40×20 world inside it scrolls.

The launcher reads `parsed.meta.viewport` to decide. `tryPlaytest()`
pins the corresponding `style.width` (mirrors the v18 fix).
`exitPlaytest()` clears it.

### 4.5  Player spawn handling

When the player spawns, the camera is **initialised** to center
the player in the viewport (clamped to world edges). This avoids
a one-frame jump from `(0,0)` to the spawn-centered position. The
init happens in `PlaytestScene.restart()`.

### 4.6  R-to-restart resets camera

`R` already resets the scene via `restart()`; v19 adds the camera
reset to the same path. After death/win banners, R replays from
spawn with the camera re-centered.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/level.js` | `parse()` reads `# viewport: WxH` → `meta.viewport = {w, h}` (or `null` for absent / `fit`). `serialize()` emits when non-null. New `setViewportDirective(text, value)` pure helper mirrors `setPickupRequiredDirective`. |
| `src/level.test.js` (or new `src/level.v19.test.js`) | parse/serialize round-trip for the directive; clamp out-of-range; `fit` ↔ absent equivalence; setter cases. |
| `src/renderer.js` | `draw()` gains optional `camera` param; on non-null camera, sets canvas dims to viewport, translates, cell-culls. The fit path is byte-identical to v18. |
| `src/renderer.test.js` | new cases: camera translate calls; cell-cull skips out-of-view cells; fit-mode (camera=null) renders identically to v18 baseline. |
| `src/play/launcher.js` | reads `parsed.meta.viewport`; sizes canvas accordingly. |
| `src/play/playtestScene.js` | new `camX` / `camY` state; new `#updateCamera()` method called from `update()`; `restart()` centers camera on spawn; `draw()` passes camera object; player overlay draws at `(x-camX, y-camY)`. |
| `src/playtestCamera.js` (new, pure) | `computeCamera(player, prev, viewport, world)` — the dead-zone math broken out as a small pure function so `node --test` can cover it without a DOM. |
| `src/playtestCamera.test.js` (new) | unit cases: player in dead-zone → camera unchanged; player crosses left edge → camera shifts; world-edge clamp; world smaller than viewport → camera = 0; spawn init centers correctly. |
| `src/loaderDialog.js` | `openPlaySettings` gains a Viewport group with radio + W/H inputs above the pickup group. The save callback returns `{ pickupRequired, viewport }`. |
| `src/main.js` | Play Settings click handler updates to handle the new viewport field — writes both directives. Pinning the canvas CSS width in `tryPlaytest()` updates to read `viewport` if present, fall back to `gridW`. |
| `tests/playtest-scroll.spec.js` (new) | Playwright e2e: a 40×16 level with `# viewport: 20×10`, press Play, walk the player to the right, assert `#preview` intrinsic stays 20×10*TILE and the rendered content changes (via canvas hashing the visible region before and after walking). |
| `TDDs/3_transcripts/version19_build.md` (new) | narrative, v8–v18 style. |

## 6. Open questions — proposed defaults

- **Dead-zone size** — proposed 40% × 33% of viewport. Standard
  platformer tuning; not author-controllable in v19 (a v20+
  Play Settings sub-row could expose it).
- **Camera ease** — instant snap to dead-zone edge vs damped
  follow. **Proposed: instant** (cheaper, deterministic, easier
  to test). Damped follow becomes a v20+ option.
- **Look-ahead** — none in v19. Looking ahead in the direction
  of movement is standard but adds state (last-input-x, decay
  timer). v20+.
- **Vertical follow vs only-horizontal** — proposed **both axes
  with the same dead-zone math**. Some platformers lock Y to
  ground; that's a v20 toggle.
- **Camera on death / win banner** — proposed **freeze** at last
  position; the banner overlays the visible viewport. (Today the
  banner overlays the whole canvas; v19 must reposition it to
  screen-space center, not world-center.)
- **Author-controlled vs auto viewport** — v19 ships
  author-controlled via Play Settings. A v20 candidate is
  "auto-shrink to fit" (compute viewport from canvas-wrap size).
- **What if the author sets viewport larger than the world?** —
  the camera-clamp formula `Math.max(0, worldW - viewW)`
  naturally yields `0`, so the world sits pinned at top-left
  inside an oversized viewport (extra space rendered as SKY).
  Acceptable; matches the fit-mode rendering for that case.

## 7. Acceptance criteria

- **A 40×16 level with `# viewport: 20×10` plays scrollably**:
  spawn near left edge → camera at `(0, ?)`; walk right → camera
  shifts to keep player inside dead-zone; reach right edge of
  world → camera clamps at `(worldW - viewportW, ?)`.
- **A 12×8 level with `# viewport: 20×10`** (smaller than
  viewport) pins camera at `(0, 0)`; the level renders as v18
  but inside a viewport-sized canvas (extra space painted SKY).
- **A level with no `# viewport:`** plays at `fit` mode — the
  v18 behaviour, byte-identical.
- **The Play Settings dialog** offers both rows; saving writes
  both directives (or removes either when set to "default").
- **Editor preview is unchanged** — the entire level is still
  visible in edit mode, regardless of `# viewport:`.
- **HUD ("coins: X / Y" + "find the exit") stays anchored** —
  visible at top-left of the viewport, not scrolled.
- **Win/Lose banner** centres on the viewport, not the world.
- **R restart** resets the camera to the spawn-centered position.
- `npm test` green; `npx playwright test` green (the existing
  4 specs + the new size-probe + the new scroll-spec).

## 8. Non-impact (explicit)

- Level format glyphs (`#`, `P`, `.`, `E`, `^`, `o`) — unchanged.
- The v11 multi-glyph rules + the v18 `# background-image:` and
  `# pickup-required:` directives — unchanged.
- The vendored `simple-platformer-1` engine and its §7 byte-
  identical invariant — unchanged. v19's camera lives entirely
  in `PlaytestScene` (v9-original glue, not vendored).
- The v18 legend, Play-in-place flow, Background dropdown,
  foreground role — unchanged.
- The v18 hotfix's CSS display-width pin — extended, not
  replaced (the pin now reads `viewportW` when set, falls back
  to `gridW`).
- The v17 single-line problems bar, hidden text pane, toolbar
  layout — unchanged.

## 9. v20+ candidates / deferred

- **Damped camera follow** — exponential ease toward the target.
- **Look-ahead camera** — shift bias in the direction the player
  is moving (or last input direction with decay).
- **Vertical lock to ground** — only Y-scroll when grounded or
  near-grounded (Mario-style).
- **Author-configurable dead-zone** — a "Dead-zone: WxH" sub-row.
- **Auto-viewport** — compute from canvas-wrap dimensions; one
  less authoring decision.
- **Per-tileset default viewport** — a tileset declares its
  preferred viewport; new levels pick it up.
- **Camera shake** — for impacts, deaths.
- **Parallax scrolling for background images** — v18's
  `# background-image:` paints stretched; v20+ could paint at a
  scroll factor < 1 for depth.
- **Multi-screen camera transitions** — Zelda-style snap to
  next room.
- **Decoration-image free placement** — v18 declared the schema;
  the placement model (drag-place + x/y storage) is the main
  v20 candidate alongside the camera polish above.
- **Layered z-order with named layers** — long-standing.
- **Cleanup of dead-end `caretLineCol` / `updateCursor` helpers**
  (v17 leftover) — still pending.
- **Per-cell animation phase offset** (v16 §8) — long-standing.
- **Pause-aware animation** — long-standing.
- **Multi-row tile atlases** (Treasure Hunters 17×5) — long-
  standing.
- **State-changing exit** (`imageActive`) — long-standing.

## 10. Risks

- **Renderer test back-compat**: the `editorDraw` signature change
  must keep the existing call sites byte-identical when no camera
  is passed. The whole v18 renderer test suite is the back-stop.
- **Player overlay sub-pixel jitter**: with `ctx.translate
  (-Math.round(camX), -Math.round(camY))` and the player drawn
  at `(Math.round(player.x - camX), ...)`, sub-pixel motion can
  shimmer. Mitigation: round consistently (always round both
  camera AND player overlay positions).
- **Dead-zone bouncing** at world edges: if the world-clamp pins
  the camera but the player is still inside the dead-zone of an
  un-clamped position, the dead-zone "shrinks" against the edge.
  This is correct behaviour (the dead-zone is in viewport
  coords, not world coords), but it does mean the player can
  walk to the literal screen edge near world boundaries.
  Acceptable; standard platformer feel.
- **Playwright determinism**: scroll tests need stable canvas
  hashes after a known number of frames. Mitigation: drive the
  player via `Input` injection (keypress events) for N frames,
  then read the canvas state. v14/v16 specs already do this.
- **No deploy risk** — bundle grows by ~1KB (camera helper +
  dialog row); Pages workflow unchanged.
