# Version 27 Build Transcript

Status: **Delivered (2026-05-24)** — _agent thread (Thread A) ships
PARTIAL: data model in place, below_ground.txt stays at v26 baseline._
Design: [../1_design/version27_design.md](../1_design/version27_design.md)
· Plan: [../2_implementation/version27_implementation.md](../2_implementation/version27_implementation.md)

| M | Commit  | Deliverable |
|---|---------|-------------|
| 1 | `22dd0ec` | `.canvas-wrap { scrollbar-gutter: stable }` — no fit-mode jog |
| 2 | `7390233` | HUD-band geometry — canvas + HUD_HEIGHT, level translated down |
| 3 | `345c905` | HUD band drawn + edit-mode placeholder |
| 4 | `81b4961` | xOffsetBucket — (cell, vxBucket, xOffsetBucket) node identity |
| 5 | `de164bf` | per-leg replan loop + acceptance gate (below_ground at v26 baseline) |
| 6 | _this commit_ | transcript + Delivered |

Tests at delivery: **295 unit / 113 Playwright**. v9 §7 invariant
preserved (`src/play/core/*` + `src/play/entities/*` untouched).

## M1 — Scrollbar-gutter fix (Thread B win, one CSS line)

The user reported a horizontal "jog" of the canvas when clicking
Play in FIT mode. Root cause walked through in the design (§3.5):
legend auto-hides → wrap widens → fit re-scales → canvas height
creeps just past wrap height → vertical scrollbar appears →
`clientWidth` shrinks by the scrollbar's reserved width → fit
re-applies → bounce. The fix is a single CSS declaration:

```css
.canvas-wrap {
  scrollbar-gutter: stable;
}
```

The wrap reserves space for a vertical scrollbar unconditionally,
so `clientWidth` is constant whether or not a scrollbar is actually
showing. No bounce, no jog. Browser support: Chrome 94+, Firefox
97+, Safari 18.2+. Older browsers see the v26 fallback — graceful
degradation; no JS shim ships.

The spec asserts three things: the CSS rule resolves to `stable`
via computed style; `wrap.clientWidth` is invariant when a
scrollbar appears (forced via a tall content spacer); the canvas's
left position is stable across Play entry under FIT mode.

## M2 — HUD-band geometry (no rendering yet)

The canvas grows by `HUD_HEIGHT_TILES * tile` (= one cell row) at
the top; level rendering wraps in `save / translate(0, hudPx) /
restore`. `cellFromEvent` subtracts the HUD height before grid-row
conversion and reports `inHud: true` for clicks in the band — the
pointerdown handler early-returns on that, so the designer can't
accidentally paint into the strip. `applyFitToScreen` /
`applyPlayFitToScreen` automatically pick up the new
`previewCanvas.height` since they read it after the renderer sets
it; the play-mode pin (`currentPlayPin.cssH`) gets `+ HUD_HEIGHT`.

The biggest test churn came from existing pixel-sample tests that
baked specific canvas y coordinates: `exit-locked-sprite`,
`spawn-settle`, `playtest-scroll`, `v23-viewport-guide`,
`v26-fit-draw`. Each updates by HUD_HEIGHT (= 24 editor px or 20
engine px). `v26-fit-draw`'s click-to-cell math computes
`cellH = r.height / (H + 1)` instead of `H` — the overlay covers
the HUD band visually so one extra effective row.

The HUD area renders as the SKY fill colour for now — M3's job is
to make it the contrasting band.

One non-obvious follow-on: the `exit-locked-sprite` test that walks
the player to collect a cherry. The walk-distance budget had to
shrink (250ms vs 600ms) because the slightly-shifted canvas
geometry meant the player at the old budget walked past the exit
into the won-banner state, which darkens the post-walk pixel
sample. Trimming the walk to stop just past the cherry keeps the
scene in `play` phase and the sample sees the bare exit sprite.

### v9 §7 carry-through

`src/renderer.js` is editor-side (not `src/play/core/*` or
`src/play/entities/*`) so the HUD translate lives there safely.
`PlaytestScene` is in `src/play/` (also not vendored) — it gains
the HUD-y player-sprite offset. No vendored upstream byte was
touched.

## M3 — HUD drawing + edit-mode placeholder

`renderer.js` exports a small `drawHud(ctx, text, tile)` that:

- Fills `(0, 0, canvas.width, hudPx)` with `--hud-bg` (read via
  `getComputedStyle(document.documentElement)` so light/dark
  switching is pure CSS, no JS theme listener).
- Renders `text` in `--hud-fg`, bold 14px monospace,
  `textBaseline: middle`, anchored at `x = 8`.
- Falls back to hardcoded greys when `getComputedStyle` is
  unavailable (Node-side renderer tests).

`PlaytestScene.draw` now passes the existing `coins: N/M …` HUD
formatter through `drawHud` — the v18-era ad-hoc `fillText` at
(8, 8) is gone. `main.js`'s editor-preview path appends
`drawHud(ctx, 'HUD: score / status', TILE)` so the designer sees
the reserved strip with placeholder text.

CSS vars added at `:root` (dark: #252526 on #ececec) and
`body.lightmode` (light: #ececec on #252526). The agent dialog +
legend popups already use the var palette pattern from v26 M2;
the same cascade approach handles light/dark cleanly.

## M4 — xOffsetBucket data model (conservative)

The largest agent change of v27. `grid.js` gains:

- `X_OFFSET_BUCKETS = ['L', 'C', 'R']`
- `xOffsetBucketOf(x)` — splits a cell into L/C/R thirds via
  sub-pixel x (~6.7 px each at TILE=20).
- `bucketCentreX(c, bucket)` — `'L'` returns `c*TILE`
  (sub-pixel 0 = v26 byte-identical); `'C'` is mid-cell;
  `'R'` is `c*TILE + 5*TILE/6`. The L-bucket representative MUST
  be sub-pixel 0; an earlier attempt placed it at `TILE/6` which
  made the player's AABB overlap the next cell at spawn and broke
  the spawn-cell tests.
- `stateKey` bumps to 4-part `(r, c, vxBucket, xOffsetBucket)`.
- `parseStateKey` returns the 4 components.
- `buildNavGraph` expands each walkable cell to 3 × 3 = 9 nodes.

**Conservative chain rule (M4 shipped):** action edges are emitted
only from `xOffsetBucket='L'` source nodes; every edge's destination
has `xOffsetBucket` pinned to `'L'`. The chain is therefore
byte-identical to v26's vxBucket-only graph. 'C' / 'R' source
nodes EXIST (M4 node-identity spec compliance) but are isolated.

Why conservative — enabling them naively (and what M5 attempted)
re-introduced a chain fragility: A* picks edges whose action
sequence assumed a specific sub-cell start; reSim's actual landing
bucket may differ; the recorded action sequence can't be re-derived
from the new sub-pixel start. Detailed in M5 below.

Test deltas:
- new: `tests/v27-bucket-graph.spec.js` (5 cases) — 9-node
  identity, `xOffsetBucketOf` thirds, 4-part `stateKey`,
  `bucketCentreX` round-trip, existing-level regression sweep.
- `tests/v26-bucket-graph.spec.js`: updated to 9 nodes per cell
  and 4-part `stateKey` assertions.
- `src/agent/grid.test.js`, `src/agent/planner.test.js`,
  `tests/v25-edge-state.spec.js`: stateKey calls extended to
  4-part with the 'L' suffix.

`planner.js`: `cellToBucket0` returns `${k},0,L` (was `${k},0`);
`ctx.position` starts at `stateKey(r, c, 0, 'L')`.

## M5 — Per-leg replan + below_ground partial

The headline goal of v27 — below_ground.txt solves end-to-end —
is NOT delivered. M5 attempted the architectural extension:

1. **Enabled non-L bucket sources.** Removed M4's conservative
   `if (n.xOffsetBucket !== 'L') continue;` gate so all 9 source
   nodes per cell emit edges. Each edge's destination carries the
   SIMULATED xOffsetBucket (not pinned to 'L').
2. **Per-leg replan in `plan()`.** After each emitted leg, derive
   the live bucket from `prevEndState`; if the next planned step's
   `from` doesn't match, replan A* from the live bucket to the
   same goal. Replan budget = 48 per goal.

**Outcome:** every multi-step chain that crossed a non-L bucket
diverged. The pattern of failure:

- A* picks an edge with `from = (cell, vxBucket=+1, xOffsetBucket='C')`
  whose action sequence was simulated from the bucket-centre start
  state (x = c*TILE + TILE/2).
- The live engine's actual start at that cell — built up through
  previous legs — is x = c*TILE + some_drift. Even when the drift
  keeps the player IN the same 'C' bucket, the action sequence
  (e.g., a jump with holdFrames=4) produces a slightly different
  trajectory than A* predicted.
- reSim's actual endState's bucket MATCHES the planned edge's
  predicted destination bucket (so the replan trigger doesn't
  fire) — but the recording's events fire at frames that don't
  align with the live physics for the slightly-off sub-pixel start.
- Replan picks alternate edges with the same fragility — chain
  doesn't converge.

**M5 shipped:**

- All v21-v26 agent-suite levels (tutorial, above_ground, simple)
  continue to solve under the conservative L-only emission
  (reverted from the experimental change above).
- below_ground.txt stays at v26 baseline (score 8 of 16; tied
  with v26's M5).
- The per-leg replan loop stays in `planner.js` as a no-op when
  the L-only chain is in effect (live bucket always 'L', always
  matches). Same data-model investment (9 nodes, 4-part
  stateKey, helpers) reusable.

**Architectural diagnosis (v27 design §10 risks expansion):**

Bucket-aware A* is fundamentally limited because finer buckets
make the chain MORE fragile, not less. Each bucket has a single
representative start state; the live engine's continuous physics
lands within the bucket but not AT the representative. An action
sequence optimal for the representative may not work for the
slightly-off live state. Cumulative drift across a multi-step
chain breaks the recording.

The right architectural step is a per-frame trajectory planner —
no bucketing of x/vx at all; A* runs over (cell, frame) nodes
with explicit physics integration per edge. v28+ candidate.

`tests/v27-below-ground-solves.spec.js` asserts:
- below_ground reaches at least v25 baseline (score ≥ 8) — the
  "PROGRESS" gate, same shape as v26 M5's acceptance.
- All v25/v26 agent-suite levels continue to solve.

## Outcomes — full summary

**Thread B (Editor UX polish) — fully delivered:**
- Scrollbar-jog fix (M1)
- HUD-band geometry (M2)
- HUD-band rendering + edit-mode placeholder + click guard (M3)

**Thread A (Agent architectural completion) — partial:**
- xOffsetBucket data model + 9-node identity (M4)
- Per-leg replan infrastructure (M5)
- Below_ground.txt at v26 baseline (NOT the targeted full solve)

**Deferred to v28+:**
- Per-frame trajectory planner (the "real" fix for below_ground)
- Below_ground.txt end-to-end solve
- Double-jump engine extension (still v9 §7 blocked)
- Reactive theme listener, viewport guide follows mouse,
  resizable legend, minimap, edit-mode resize, linked levels,
  slopes, multi-exit, Lemmings-AI, path-hint tutorial,
  AI-rated difficulty, AI level designer, legacy-tileset
  `imageLocked` updates.

**No deploy risk** — CSS +0.09 kB, JS +1.6 kB net of M4-M5
data-model additions. Same order as v22-v26 increments.

## Lessons for v28

1. **Don't discretise what you can integrate.** The xOffsetBucket
   experiment confirms a coarser-vs-finer trade-off where finer
   buckets actively hurt chain reliability. The fix is to stop
   bucketing position entirely and integrate physics per frame.
2. **L = sub-pixel 0 is the v26 invariant.** Any bucket
   representative for the 'L' third must be exactly `c*TILE` to
   keep AABB-vs-cell-edge logic stable.
3. **Recording-vs-reSim consistency.** reSim uses the LIVE state;
   the recorded events use A*'s build-time action. Per-leg replan
   that triggers on bucket mismatch alone isn't enough — even
   matching buckets can have intra-bucket drift that the
   recording can't compensate for.
