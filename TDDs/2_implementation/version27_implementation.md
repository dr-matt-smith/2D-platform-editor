# Version 27 — Implementation Plan

Status: **Proposed (2026-05-23)** · Design:
[../1_design/version27_design.md](../1_design/version27_design.md)
· Transcript: _to follow at M6_

Six path-scoped commits. Thread B's small scrollbar-jog fix lands
first (one CSS line, isolated test) so a regression there is
unambiguous. The HUD band lands as two milestones — infrastructure
(M2) then rendering + click-guard (M3) — keeping the diff
reviewable. Thread A's xOffsetBucket expansion follows the v26
M4/M5 split: primitives + grid expansion first (M4), then the
planner arity bump and acceptance gate (M5).

| M | Deliverable |
|---|-------------|
| 1 | `.canvas-wrap { scrollbar-gutter: stable }` + jog spec |
| 2 | HUD vars + renderer / overlay / editor offset by HUD_HEIGHT |
| 3 | HUD drawing in play + edit; click-y < HUD_HEIGHT no-op |
| 4 | `xOffsetBucketOf` + 5-part `stateKey` + grid 9× expansion |
| 5 | planner stateKey arity + below_ground acceptance gate |
| 6 | acceptance + transcript + Delivered |

Tests at delivery target: 295+ unit / 100+ Playwright. v9 §7
invariant preserved.

## Process (same discipline as v8–v26)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  Never-stage: `__temp/wish_list.md`, `__temp/next_version.md`,
  `__temp/test_levels/`, `__temp/screenshots/`,
  `public/data/levels/manifest.json` (modifications),
  `public/data/levels/above_ground2.txt`, `fred.txt`, tileset
  `src.txt` / `sources.txt` modifications, kenney
  `flag_green.png`.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v27 only touches editor
  modules (`main.js`, `renderer.js`, `style.css`, `overlay.js`,
  `playtestScene.js` is editor-side) and `src/agent/*`.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - M1 (scrollbar-gutter) is a pure CSS one-liner. Falls back
    silently on browsers that don't support it (v26 behaviour).
  - M2 (HUD infrastructure) bumps canvas height by HUD_HEIGHT
    everywhere. Every cell-from-pixel calculation gets a `-
    HUD_HEIGHT` offset. The whole agent suite must continue to
    pass at the M2 gate — cell math is the risk.
  - M3 (HUD drawing) is pure render — no physics, no graph.
  - M4 (xOffsetBucket) is the riskiest agent change. The
    v25/v26 graph + planner test suites must continue green;
    only the *expected node count* changes (3 → 9 per cell).
  - M5 (planner) — the prefix-match `aStar(graph, from, to)`
    contract stays the same (`from` is stateKey, `to` is
    cellKey). Only the stateKey arity changes from 3 to 4
    components.
- **Bucket discretisation choice**: 3 thirds (L/C/R) at TILE=20
  → ~6.7 px per bucket. If below_ground still doesn't solve at
  M5, drop to 4 quarters (5 px each) before failing the
  milestone.
- **HUD design constants**: `HUD_HEIGHT = TILE` (a single
  source of truth in `src/renderer.js`); `--hud-bg` / `--hud-fg`
  CSS vars extending the v26 palette.
- **9× graph nodes profiling**: at M4, log
  `buildNavGraph` time + node count for each shipped level. If
  > 4 s on any level, gate M5 on a pruning pass (only enumerate
  buckets the player can physically arrive in).

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/style.css` | `.canvas-wrap { scrollbar-gutter: stable; }` (one line in the existing rule). | M1 |
| `tests/v27-fit-scrollbar.spec.js` (new) | Enable Fit. Record `wrap.clientWidth`. Minimise legend → record again. Click Play (auto-hides legend) → record. Assert all three reads identical | M1 |
| `src/renderer.js` | Export `HUD_HEIGHT = TILE`. `draw()` does `ctx.translate(0, HUD_HEIGHT)` before level layers (sky / grid / atlas / glyphs / tiles all shift). Canvas size = `worldH + HUD_HEIGHT` | M2 |
| `src/style.css` | New `--hud-bg` + `--hud-fg` at `:root` (dark = `#252526` / light fg) + at `body.lightmode` (light = `#ececec` / dark fg) | M2 |
| `src/main.js` | Preview canvas height = `gridH * TILE + HUD_HEIGHT`. `cellFromEvent` subtracts HUD_HEIGHT from `pageY - rect.top` before grid-cell conversion. `applyFitToScreen` / `applyPlayFitToScreen` divisors include HUD_HEIGHT in `intrinsicH` | M2 |
| `src/agent/overlay.js` | Overlay canvas dims match preview (already does); overlay path-rendering y coords gain HUD_HEIGHT offset (same rule as renderer) | M2 |
| `tests/v27-hud-geometry.spec.js` (new) | Canvas height = level rows × TILE + HUD_HEIGHT; clicking a known cell with HUD offset flips the expected grid cell; agent path overlay aligns with the offset level cells | M2 |
| `src/renderer.js` (or new `src/hud.js`) | `drawHud(ctx, text)` renders the dark bg strip + `bold 14px monospace` left-aligned text at `y = HUD_HEIGHT / 2` | M3 |
| `src/play/playtestScene.js` | `draw()` calls editor-side renderer first (which now offsets) then `drawHud(ctx, this.hudText())` on top | M3 |
| `src/main.js` | Edit-mode preview draws HUD with placeholder text ("HUD: score / status"). Click handler: `if (clickY < HUD_HEIGHT) return;` (no painting in HUD band) | M3 |
| `tests/v27-hud-row.spec.js` (new) | HUD band renders in play mode with the scene's `hudText()`; HUD band renders in edit mode with placeholder; click in HUD band (y < HUD_HEIGHT) is a no-op (no cell painted) | M3 |
| `src/agent/grid.js` | Export `xOffsetBucketOf(x)` + `X_OFFSET_BUCKETS = ['L', 'C', 'R']`. `stateKey` arity 4 (cell, vxBucket, xOffsetBucket). `parseStateKey` returns `{ r, c, vxBucket, xOffsetBucket }`. `addActionEdges` enumerates each `(vxBucket, xOffsetBucket)` start; initial `startState.x = c*TILE + (offset within bucket)` | M4 |
| `src/agent/grid.test.js` | All 3-part `stateKey(r, c, 0)` calls → `stateKey(r, c, 0, 'L')` (or whichever); helper `cellOf(k)` strips both suffixes | M4 |
| `tests/v27-bucket-graph.spec.js` (new) | Asserts `buildNavGraph(p_3x5).nodes.size === walkable_cells × 9`; asserts every node key has 5 comma-separated parts; asserts `xOffsetBucketOf(0) === 'L'`, `…(TILE/2) === 'C'`, `…(TILE - 1) === 'R'`; logs graph-build time for each shipped level | M4 |
| `src/agent/planner.js` | `cellToBucket0(k)` returns 5-part stateKey (`${cellKey},0,L`). Spawn start = `stateKey(spawn.r, spawn.c, 0, 'L')`. A* goal prefix-match unchanged. `emitLegInputs` re-simulation is unchanged (it reads `endState`, which already encodes sub-pixel x) | M5 |
| `src/agent/planner.test.js` | `from` args extended to 4-part stateKey | M5 |
| `tests/v27-below-ground-solves.spec.js` (new) | below_ground.txt solves end-to-end in ≤ 5 s; `.badge.ok` shown; all 16 pickups collected. Replaces v26's PROGRESS assertion | M5 |
| Existing agent suite | All v21–v26 cases continue to pass; `tests/v26-bucket-graph.spec.js` updated expectation: 9 nodes per cell not 3 (or kept as-is with new v27 spec superseding) | M5 gate |
| `TDDs/3_transcripts/version27_build.md` (new) | narrative covering M1–M5 | M6 |

## Milestone 1 — Scrollbar-gutter fix

The smallest possible Thread B win. Pure CSS, instant
verification.

1. `src/style.css`: locate the `.canvas-wrap` rule. Add one
   declaration:
   ```css
   .canvas-wrap {
     /* ... existing rules ... */
     scrollbar-gutter: stable;
   }
   ```
2. `tests/v27-fit-scrollbar.spec.js` (new):
   - Load a tall level (below_ground.txt is enough).
   - Click the Fit toggle on.
   - Read `wrap.clientWidth` → record `w1`.
   - Click the legend "minimise" → read again → `w2`.
   - Click Play (auto-hides legend) → read again → `w3`.
   - Assert `w1 === w2 && w2 === w3`.
3. Verify: `npm test`, `npx playwright test` (new case passes;
   none regress).

Path-scoped commit:
```
git add src/style.css tests/v27-fit-scrollbar.spec.js
git commit -m "v27 m1: .canvas-wrap scrollbar-gutter: stable — no fit-mode jog"
```

## Milestone 2 — HUD-band geometry (no rendering yet)

The canvas grows by HUD_HEIGHT. Every cell math gets the offset.
The HUD area renders as the existing background colour (no
band visible yet — that's M3) so the visible diff is purely the
extra blank row at the top.

1. `src/renderer.js`:
   - `export const HUD_HEIGHT = TILE;`
   - In `draw(ctx, parsed, legend, opts)`:
     - Canvas size: `ctx.canvas.width = cols*TILE; ctx.canvas.height = rows*TILE + HUD_HEIGHT;`
     - Wrap level rendering in `ctx.save(); ctx.translate(0, HUD_HEIGHT); ... ctx.restore();`
2. `src/style.css`:
   - Add to `:root`: `--hud-bg: #252526; --hud-fg: #ececec;`
   - Add to `body.lightmode`: `--hud-bg: #ececec; --hud-fg: #252526;`
3. `src/main.js`:
   - `applyFitToScreen()` / `applyPlayFitToScreen()` — when
     computing intrinsicH, add HUD_HEIGHT to the row*TILE value.
   - `cellFromEvent(ev)` — subtract HUD_HEIGHT from the y
     pixel value before dividing by TILE.
   - Edit-mode preview canvas height — `gridH * TILE + HUD_HEIGHT`.
4. `src/agent/overlay.js`:
   - Path-rendering y coords offset by HUD_HEIGHT (same
     translate pattern as renderer).
5. `tests/v27-hud-geometry.spec.js` (new):
   - Load a known level (24×10 tutorial). Read canvas height;
     assert `=== 10 * TILE + HUD_HEIGHT`.
   - Click at known pixel position; assert the cell that flips
     is the cell BELOW the HUD band (offset of one TILE).
   - Run the agent on tutorial → path overlay y-coords offset
     correctly (last cell of path overlaps last cell of level).
6. Acceptance: full Playwright suite must still pass (every
   click test is now offset-aware; some may need re-baselining).

Path-scoped commit. Likely also touches a few existing tests
where pixel coords are baked in — those get updated as part of
this milestone.

```
git commit -m "v27 m2: HUD_HEIGHT canvas offset + overlay/main.js sync"
```

## Milestone 3 — HUD drawing + click guard

The visible delivery. The HUD bg + text appears at the top of
the canvas; click-to-paint inside the band is suppressed.

1. `src/renderer.js` (or new `src/hud.js` — single small fn):
   ```js
   export function drawHud(ctx, text) {
     ctx.save();
     ctx.fillStyle = getCssVar('--hud-bg') || '#252526';
     ctx.fillRect(0, 0, ctx.canvas.width, HUD_HEIGHT);
     ctx.fillStyle = getCssVar('--hud-fg') || '#ececec';
     ctx.font = 'bold 14px monospace';
     ctx.textAlign = 'left';
     ctx.textBaseline = 'middle';
     ctx.fillText(text, 8, HUD_HEIGHT / 2);
     ctx.restore();
   }
   ```
2. `src/play/playtestScene.js`:
   - Inside `draw()`, after the existing renderer call:
     `drawHud(ctx, this.hudText());`
   - `hudText()` already exists from v18 (returns the
     `"coins: 3 / 4 → find the exit"` string format); reuse.
3. `src/main.js`:
   - In the edit-mode preview render path, append
     `drawHud(ctx, 'HUD: score / status');`
   - In the canvas click handler:
     `if (ev.offsetY < HUD_HEIGHT) return;`
4. `tests/v27-hud-row.spec.js` (new):
   - Load a level; assert canvas pixel at `(8, HUD_HEIGHT/2)`
     is non-background (HUD bg colour). (Sample via
     `ctx.getImageData`.)
   - Click at `(40, HUD_HEIGHT / 2)` — assert no cell painted.
   - Click at `(40, HUD_HEIGHT + TILE/2)` — assert the
     row-0 cell IS painted (sanity).
   - Enter play mode → assert HUD shows `"coins:"` substring.
5. Verify full Playwright suite passes.

```
git commit -m "v27 m3: HUD band drawn + edit-mode placeholder + click guard"
```

## Milestone 4 — xOffsetBucket primitives + grid expansion

Thread A starts. Pure data-model change at the graph layer.

1. `src/agent/grid.js`:
   - `export const X_OFFSET_BUCKETS = ['L', 'C', 'R'];`
   - `export function xOffsetBucketOf(x) { const sub = x - Math.floor(x/TILE)*TILE; if (sub < TILE/3) return 'L'; if (sub < 2*TILE/3) return 'C'; return 'R'; }`
   - `export const stateKey = (r, c, vxBucket = 0, xOffsetBucket = 'C') => \`${r},${c},${vxBucket},${xOffsetBucket}\`;`
   - `parseStateKey(k)` returns `{ r, c, vxBucket, xOffsetBucket }`.
   - `buildNavGraph`: for each walkable cell, enumerate
     `vxBucket × xOffsetBucket` (3 × 3 = 9 nodes).
   - `addActionEdges`: starts each action from a synthetic
     state `{ x: c*TILE + bucketOffsetX(xOffsetBucket), y: r*TILE, vx: bucketVx(vxBucket), vy: 0, onGround: true }` where `bucketOffsetX('L') = 1`, `('C') = TILE/2`, `('R') = TILE - 1` (just inside each bucket — sub-pixel; mid-bucket would be `TILE/6`, `TILE/2`, `5*TILE/6`).
2. `src/agent/grid.test.js`:
   - Every `stateKey(r, c, 0)` call → `stateKey(r, c, 0, 'L')`.
   - Update node-count assertions: walkable cells × 9.
   - `cellOf(k)` helper updated to strip both suffixes.
3. `tests/v27-bucket-graph.spec.js` (new):
   - `xOffsetBucketOf(0) === 'L'`, `…(TILE/2) === 'C'`, `…(TILE - 1) === 'R'`.
   - Parse a 3×5 level (3 walkable cells); `buildNavGraph`
     reports `nodes.size === 27` (3 × 9).
   - Every node-key has 5 comma-separated components.
   - Log `buildNavGraph` time on each shipped agent-suite
     level — copy values into the M5 transcript notes.
4. `tests/v26-bucket-graph.spec.js`:
   - The "graph node count = walkable-cells × 3" test now
     expects × 9; update or supersede.
   - The "stateKey + parseStateKey" test gets a 4-part key
     check; update.

```
git commit -m "v27 m4: xOffsetBucket — (cell, vxBucket, xOffsetBucket) node identity"
```

## Milestone 5 — Planner arity + below_ground acceptance

The acceptance gate. Below_ground.txt must solve end-to-end.

1. `src/agent/planner.js`:
   - `cellToBucket0(cellKey)` returns `\`${cellKey},0,L\``.
   - Spawn start node: `stateKey(spawn.r, spawn.c, 0, 'L')`.
   - A* prefix-match unchanged (goal is still `cellKey` 2-part;
     any of the 9 bucket variants of the cell wins).
   - `emitLegInputs`: re-simulation reads `prevEndState`,
     which already encodes sub-pixel x. No code change here.
2. `src/agent/planner.test.js`:
   - Every `from` argument bumps to 4-part stateKey.
3. `tests/v27-below-ground-solves.spec.js` (new):
   - Fetch `below_ground.txt`.
   - Inject into editor, click Test.
   - Assert `.badge.ok` shown within 5000 ms.
   - Assert pickup stat pill says `16 / 16`.
4. Agent-suite regression sweep:
   - tutorial.txt, above_ground.txt, simple.txt — all still
     solve.
   - tower-cherry (v21 acceptance) still solves.
5. **If below_ground STILL doesn't solve at M5**:
   - First mitigation: bump X_OFFSET_BUCKETS to 4
     (`['Q1', 'Q2', 'Q3', 'Q4']` with TILE/4 boundaries).
     Re-run; node-count assertions update to `cells × 12`.
   - If still failing: M5 ships as PARTIAL PROGRESS (like v26)
     and the per-frame-trajectory planner becomes a v28
     candidate. Document in the transcript.
6. `npm run build` clean; `npm run build:pages` clean.

```
git commit -m "v27 m5: planner 5-part stateKey + below_ground solves end-to-end"
```

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `TDDs/3_transcripts/version27_build.md` (new): narrative covering:
   - The scrollbar-gutter one-liner (root cause: legend
     hide/minimise widens wrap → fit recomputes → canvas
     grows just past wrap height → vertical scrollbar appears
     → clientWidth shrinks → jog).
   - HUD band geometry (HUD_HEIGHT = TILE; renderer translate;
     cellFromEvent offset; agent overlay sync).
   - HUD drawing (CSS vars + drawHud + edit-mode placeholder
     + click guard).
   - xOffsetBucket (TILE/3 thirds; 9 nodes per cell;
     buildNavGraph time on shipped levels).
   - Whether below_ground solved fully or partially; what the
     observed graph-build time was.
2. Mark design + impl Delivered with the M1–M6 commit-hash table.

```
git commit -m "v27 m6: acceptance + v27 transcript; design + impl Delivered"
```

## Risks & sequencing

- **M1 scrollbar-gutter fallback** — Safari pre-18.2 won't apply
  it and the v26 jog persists. Acceptable graceful degradation;
  no JS shim ships.
- **M2 cell math regression** — every pixel-y → cell-r conversion
  needs the HUD offset. Easy to miss one. Mitigation: full agent
  + tileset Playwright suites at M2 gate. New
  `tests/v27-hud-geometry.spec.js` covers the specific transform.
- **M2 fit math overflow** — adding HUD_HEIGHT to intrinsicH
  means the canvas is taller; the fit ratio = `Math.min(availW/iW,
  availH/iH)` shifts slightly. Pre-/post-M2 fit values may differ
  by a few percent (the canvas was scaled to fit BEFORE the band;
  now it scales to fit WITH the band). Visual delta is small.
  Mitigation: pre/post screenshot diff under fit on/off.
- **M3 HUD font rendering** — `getImageData` colour-sample tests
  can be flaky across browsers. Mitigation: assert "not exactly
  the background colour" rather than an exact RGB.
- **M4 9× graph nodes blow the 5 s budget** — typical 24×14 level
  with ~150 grounded cells × 46 actions × 9 buckets = ~62k sim
  runs per buildNavGraph. At ~50µs each, ~3.1 s. Within budget
  but tight. Mitigation: M4 logs the timings; M5 gates on
  "below_ground builds in < 4 s." If tight, add the "only
  enumerate physically-reachable buckets" pruning.
- **M5 below_ground still doesn't solve** — 3-bucket xOffset may
  still be too coarse. Fallback: 4 buckets (5 px each). Beyond
  that, per-frame trajectory planner becomes the v28 candidate.
- **M5 v22-v26 levels regress** — every agent suite test runs at
  the M5 gate. Mitigation: 9× graph is a SUPERSET of 3× graph
  (any 3-bucket solve is reachable via {bucket=L} subgraph); a
  regression would be a planner bug, not a discretisation issue.
- **No deploy risk** — bundle size grows ~2 KB (renderer
  translate + drawHud + xOffsetBucket primitives). JS grows
  ~3 KB. Same order as v22–v26.

## Deferred (design §9 → v28+)

- **Per-frame-trajectory planner** — if 9-bucket A* still can't
  solve some levels.
- **Double-jump engine extension** — would break v9 §7
  invariant; needs explicit user approval.
- **Reactive theme listener** (OS-pref flips mid-session).
- **Viewport guide follows mouse**.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence**.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles** (engine change).
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.
- **Update legacy tilesets for v22.1 `imageLocked`** — minor
  carryover.

Plus the long-standing v16/v17/v18/v19 carry-overs.
