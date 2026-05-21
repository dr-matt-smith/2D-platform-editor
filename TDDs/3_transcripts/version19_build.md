# Transcript — Version 19: Scrolling Playtest + Viewport Play Setting

A narrative record of the v19 phase: making big levels playable.
v18 made the editor canvas the play surface (play-in-place); v19
makes that surface **track the player** so a level wider than the
viewport remains usable instead of being CSS-shrunk into a
microscope view.

## The brief

User suggested it during v18 wrap-up:

> what features should we work on for next version? how about
> scrolling in the play mode?

Picked from a candidate-feature menu (scrolling + viewport Play
Setting won over decoration-image placement + layered z-order;
the other carry-overs slipped to v20). The v18 deferred-list
gave the architectural starting point: camera math as a pure
helper (DOM-free unit tests), renderer integration via an
additive trailing parameter (camera-null path byte-identical to
v18), no upstream engine changes.

## The shape of the work

Six small commits, one milestone each, in dependency order:

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `5bd8145` | `level.js`: `meta.viewport` field, `# viewport: WxH \| fit` parse/serialize with clamp to [4, 200]; pure `setViewportDirective`; `level.v19.test.js` 19 cases including coexistence with the v18 `# background-image:` + `# pickup-required:` directives. |
| 2 | `5b8edce` | new pure `src/playtestCamera.js` — `centerCamera()` for spawn init, `computeCamera()` for dead-zone follow (40% × 33% defaults, world-edge clamp). 14 unit cases including a purity assertion via `Object.freeze`. |
| 3 | `b560b10` | `renderer.js` `draw()` gains optional trailing `camera` arg. When null, byte-identical to v18; when set, canvas → viewport, `ctx.save/translate/restore` brackets world drawing, all 6 cell loops cull to visible band + 1-cell bleed. 6 new test cases including a cull-saves-≥50%-of-draws check. |
| 4 | `6e2937e` | `launcher.js` reads `parsed.meta.viewport` to size canvas; `playtestScene.js` gets `camX/camY` state + `centerCamera` on spawn + `computeCamera` in update + player overlay shift; `#banner` reads canvas dims so YOU WIN centres on the viewport; `main.js` CSS-pin reads viewport.w when set. |
| 5 | `06bfac1` | `openPlaySettings()` gains a Viewport group above the Pickup group (Fit radio / Window WxH radio with number inputs); save callback returns `{ pickupRequired, viewport }`; `main.js` chains both setters through one `applyEdit` so the dual-directive write is a single undo step. |
| 6 | _this commit_ | `tests/playtest-scroll.spec.js` (40-wide world, 16x10 viewport, walk right, hash changes); v19 transcript; design + impl Delivered. |

Outcome: 178 → 217 unit tests (+19 schema + 14 camera + 6 renderer
camera). Playwright 5 → 6 (the new scroll spec). Both builds clean
throughout. The vendored engine TILE=20 is byte-untouched; the
v9 §7 invariant holds across all six commits.

## The pure-camera-math call

The biggest architectural call was where the camera math lives.
Three options were on the table:

1. **Inside the upstream `Game`/`Scene` loop** — touches vendored
   code; breaks v9 §7.
2. **As state-and-methods on `PlaytestScene`** — direct, but mixes
   physics state (player, dt, scoring) with view state (cam, dead-
   zone tuning), and the math becomes hard to unit-test without a
   DOM.
3. **As a pure helper module imported by `PlaytestScene`** — the
   chosen option.

The v18 `meetsPickupRequirement` precedent made (3) the obvious
fit: a small `src/playtestCamera.js` with two exported functions
(`centerCamera` + `computeCamera`), both taking primitives in and
returning a fresh `{camX, camY}`. `PlaytestScene` owns the state
(this.camX, this.camY, this.viewport) and calls the helpers each
frame; `node --test` covers the math with frozen inputs and
deterministic assertions.

The dead-zone defaults (40% × 33% of viewport) are buried inside
`computeCamera` as constants; the `opts.deadZone` override exists
so author-configurable dead-zones become a one-line wire-up
addition in v20+ without a math change.

## The renderer's optional-camera signature

The v14/v18 decision was to keep `editorDraw()` as the single
source of pixel truth (the playtest canvas paints through the
same renderer the editor uses). v19 had to extend that without
either:

- Breaking the existing call sites (editor `run()`, fit-mode
  playtest, the four Playwright specs hashing canvases at known
  values), or
- Restructuring the renderer into two functions (`draw` + `drawWindow`).

The signature gained one **trailing optional** parameter
(`camera = null`). The whole body branches on `if (camera) {…}`
exactly twice — once for the canvas-size + iteration-range
computation at the top, once for the `ctx.save/translate` /
`ctx.restore` brackets. The 6 cell loops use `r0/r1/c0/c1` bounds
that, when `camera` is null, equal `0/grid.length/0/meta.width` —
the literal v18 ranges.

The cell-cull (`Math.floor(camX/tile) - 1` to `Math.ceil((camX +
viewW)/tile) + 1`) is a perf win that also keeps the neighbour-
aware atlas decor pass correct: a `#` just outside the visible
band still gets iterated so the grass-tuft it would paint at
`r-1` (inside the band) shows up. Without the 1-cell bleed, edge
tiles would lack their decor in scrolled mode.

## Play-in-place + scrolling: how they compose

v18's hotfix (`36354f1`) pinned the CSS display width of `#preview`
to `gridW * editorTILE` so the engine TILE/editor TILE mismatch
didn't shrink the play canvas. v19 extends that pin with
`(viewport.w ?? gridW) * editorTILE` — same logic, viewport-aware.

The visible result:

- A pre-v19 level (no `# viewport:`): exactly the v18 behaviour.
  The size-probe spec (which the v18 hotfix shipped as its
  regression guard) still passes byte-for-byte.
- A v19 level with `# viewport: 16x10`: the canvas intrinsic is
  `320 × 200` (16 × engine TILE), displayed at `384 × 240` CSS
  pixels (16 × editor TILE) — exactly the on-screen size of a
  16-cell-wide editor view.

The IDE-pixel size of the canvas is a function of the **author's
chosen viewport**, not the level's grid dims. A 200×200 world
with `# viewport: 20x12` shows the player at the same on-screen
scale as a 20×12 world with no `# viewport:` — the renderer
doesn't know or care which.

## The Play Settings dialog grew without growing

v18 carved out a single-row dialog (pickup requirement) on the
hunch it would grow. v19 added the second row in the natural
shape: same `.ps-rows` / `.ps-row` markup, same CSS, same Esc /
backdrop / Save / Cancel affordances. The only API change was the
save callback's shape (`(value) => …` became `({ pickupRequired,
viewport }) => …`), which is a one-call-site update in `main.js`.

The dual-directive write goes through one `applyEdit` call: both
`setPickupRequiredDirective` and `setViewportDirective` chain on
`src.value` and the combined `updated` string is applied once,
producing a single undo step. The undo history doesn't fragment
even when the user touches both rows in the same dialog open.

## Hiccups along the way

**M4 IncaTiles bundle**: between the M3 commit and M4, the user's
IDE staged a fresh `public/data/tilesets/IncaTiles/` directory
(5 files) into the git index. I didn't `git status` before
committing M4 — `git diff --cached --name-only` after my
path-scoped `git add` showed 8 files where I expected 3. The
user chose to leave the M4 commit as-is (the IncaTiles directory
IS a real tileset draft they wanted committed; the bundling was
unsignalled but the result is fine). The discipline going forward:
`git status` before every commit.

**M5 SynnyLand un-stage**: the same pattern recurred at M5 — a
`SynnyLand/src.txt` had been staged externally. This time I
caught it with `git status`, used `git restore --staged
SynnyLand/src.txt` to un-stage it, and the M5 commit went out
clean (3 files, exactly the three I authored). The
[[scoped-git-add]] memory's "always verify the index before
committing" rule held.

**M3 cell-cull test threshold**: my first version of the
"cull saves drawImage calls" test asserted `≤ 250` draws.
With a non-atlas tileset (sky pass + atlas-decor pass both off)
the actual count was much lower; with atlas-on, much higher. I
softened to "≥ 50% reduction relative to the world path", which
holds across atlas and non-atlas tilesets.

## What stayed out (v20+ candidates carried forward)

The natural follow-ups for the camera + viewport feature pair:

- **Damped camera follow** — exponential ease toward target.
- **Look-ahead camera** — directional bias in the input direction.
- **Vertical lock to ground** — Mario-style Y discipline.
- **Author-configurable dead-zone** — Play Settings sub-row;
  `opts.deadZone` is already a `computeCamera` parameter, so it's
  a one-line wire-up.
- **Auto-viewport** — compute from canvas-wrap dimensions.
- **Per-tileset default viewport** — declared in lookup.
- **Camera shake** — for impacts, deaths.
- **Parallax scrolling for background images** — v18's
  `# background-image:` paints stretched; a scroll factor < 1
  would give depth.
- **Multi-screen camera transitions** — Zelda-style snap.

The carry-forwards from v18:

- **Decoration-image free placement** — v18 declared the schema,
  v19 didn't touch it. v20 candidate.
- **Layered z-order with named layers** — long-standing.
- **`cover` / `contain` modes for the background image** — v18
  stretches.
- **More Play Settings rows** — gravity, jump preset, time limit,
  lives, spike one-shot. v19 added one row; the pattern is
  established.

And the long-standing carry-overs:

- **Cleanup** of v17's dead-end `caretLineCol` / `updateCursor` /
  `lineColToCaret` helpers.
- **Per-cell animation phase offset** (v16 §8).
- **Pause-aware animation**.
- **Multi-row tile atlases** (Treasure Hunters 17×5).
- **State-changing exit** (`imageActive`).

## The standing gap

Unchanged from v13/v14/v15/v16/v17/v18 — no automated DOM-mutation
test of the broader interactive surface beyond Playwright. v19
grew the unit suite from 178 to 217 (+39: schema 19, camera 14,
renderer-camera 6). The Playwright suite went 5 → 6 (the new
scroll spec); the four pre-v19 specs (tileset capture +
distinctness + playtest-tileset + playtest-animation) plus the
v18 size-probe all stayed green throughout the v19 build.

The scroll-spec asserts both halves of the geometry contract: the
canvas intrinsic equals the viewport dims (not the world's), AND
the canvas hash changes after a horizontal walk (the camera
scrolled into previously-off-screen world cells). Paired with the
v18 size-probe (which guards the on-screen rect for fit mode),
the e2e suite now covers both the no-scrolling and the scrolling
play-in-place geometry paths.
