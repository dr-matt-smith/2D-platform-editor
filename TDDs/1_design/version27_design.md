# 2D Level Designer — Version 27 Design Document

Status: Proposed · Date: 2026-05-23 · Builds on:
[version26_design.md](version26_design.md) (CSS-var refactor + fit-draw
overlay + sub-pixel A*) · Implementation: *to follow once this scope
is approved*.

## 1. Purpose

Two threads. The agent-architectural completion v26 documented as
its carry-over (below_ground's tight tolerances need finer state
than 3-bucket vxBucket alone), and the "top messages row" feature
the user added to the v25 wishlist that's been waiting through
v25 and v26.

### Thread A — Agent architectural completion (v26 carry-over)

1. **Sub-cell x-offset state buckets.** v26's 3-value vxBucket
   wasn't enough — `below_ground.txt` advances from score 8 → 12
   but still can't reach the exit because two cells with
   different sub-pixel x offsets fall into the SAME bucket. Add
   `xOffsetBucket` (3 values: `left/centre/right` third of a
   cell) as a SECOND state dimension. Node identity becomes
   `(r, c, vxBucket, xOffsetBucket)` — 9 nodes per cell instead
   of 3.

   **Acceptance**: `below_ground.txt` solves end-to-end within
   5 s; all v21–v26 levels continue to solve.

### Thread B — Top messages row

2. **A reserved row at the top of every level for HUD / score /
   status messages.** Currently the in-game HUD text (`"coins:
   3 / 4 → find the exit"`) renders over level cells the
   designer might want the player to visit. v27 ships a dedicated
   row that:
   - Renders with a distinct dark-grey background + light-grey
     text style (so it's visually separate from level tiles).
   - Doesn't collide with the player physically — the character
     can jump UP into the row's pixel space without bumping
     against tiles, and FALL down from it without obstruction.
   - Hosts the score + status messages so they don't compete
     with level art.
   - Is visually distinct in EDIT mode too (the designer
     understands it's reserved).

### Out of scope (proposed deferrals)

- **Double-jump engine extension** — still requires explicit
  user approval to break v9 §7 byte-identical invariant. v28+
  candidate.
- **Reactive theme listener** (OS-pref flips mid-session) —
  small, no user signal demanding it.
- **Viewport guide follows mouse** — long-standing.
- **Minimap / level-resize / linked-levels / slopes /
  multi-exit / 1-way platforms / Lemmings-AI / AI level
  designer** — all bigger features; each warrants its own
  version focus.

## 2. Current state

### Agent (v26)

- Action enumeration: 46 candidates per grounded cell.
- Edges carry sub-pixel `endState` (v25 M1).
- Planner re-simulates each step from `prevEndState` (v25 M2).
- `precision_landing` rule emits extra edges for ±2 px target
  passes (v25 M4).
- Node identity is `stateKey(r, c, vxBucket)` with
  `vxBucket ∈ {-1, 0, +1}` (v26 M4).
- **below_ground.txt**: collects 8 row-7 + 4 row-5 ooo's →
  score 12 of 16; stalls at (5, 29) → timeout at frame 2400.
- Diagnosis: vxBucket discretisation is coarser than the
  actual sub-pixel-x drift. Two states with different sub-cell
  x positions fall into the SAME `(cell, vxBucket)` node;
  A* picks an edge that doesn't reflect the actual physics.

### HUD (v18 + later)

- `PlaytestScene.draw` renders the HUD text via `ctx.fillText`
  inside the canvas, at a fixed pixel offset (~16px from top).
- Text uses `COLOURS.text` (light) on the level's background
  (sky / atlas / colour fallback) — readable but VISUALLY
  COMPETING with level tiles in the same area.
- No dedicated band; no special parser handling; no collision
  exemption.

## 3. Architecture

### 3.1  Sub-cell x-offset state buckets

`xOffsetBucket(x)` discretises the player's AABB-left x position
within its cell:

```js
export function xOffsetBucketOf(x) {
  const sub = x - Math.floor(x / TILE) * TILE; // sub-pixel within cell
  if (sub < TILE / 3) return 'L';        // left third
  if (sub < (2 * TILE) / 3) return 'C';  // centre third
  return 'R';                              // right third
}
export const X_OFFSET_BUCKETS = ['L', 'C', 'R'];
```

Node identity changes:

```js
export const stateKey = (r, c, vxBucket = 0, xOffsetBucket = 'C') =>
  `${r},${c},${vxBucket},${xOffsetBucket}`;
```

(Note: bumping arity from 4-part to 5-part. tests and grid/planner
internals that parse keys need an update.)

**Graph growth**: 9 nodes per cell instead of 3. The action
enumeration runs from each `(cell, vxBucket, xOffsetBucket)`
start with the corresponding initial vx + sub-pixel x. Total
graph size grows 9× compared to v25, or 3× compared to v26.

**Bucket discretisation rationale**: TILE=20 px; thirds = ~6.7 px
each. The walk speed is 240 px/s = 4 px/frame at 60fps, so a 5-
frame walk advances the player by 20 px = exactly one cell —
xOffsetBucket stays the same across walk steps when start was
aligned. Jumps complicate this; the bucket distinction matters
for the LATE jumps in below_ground where small sub-pixel
differences matter.

**Risk**: 9× graph nodes means 9× edge enumeration time. For
24×14 levels (~150 grounded cells) × 46 actions × 9 buckets =
~62k sim runs per buildNavGraph. At 50µs each, ~3.1s. Within the
5s primary budget but tight. Mitigation: only enumerate buckets
that are physically reachable (don't enumerate xOffsetBucket=R
for cells where the player can't arrive in that sub-position).

### 3.2  Top messages row

**Visual structure**: a dedicated HUD strip rendered at the TOP
of the canvas, occupying ONE cell-height (TILE px) in play mode
and edit mode. Drawn OVER the existing canvas — not part of the
level grid; not part of the level's row/col coordinate system.

**Coordinate model**: the level's `(r, c)` cell coordinates are
unchanged. The HUD band lives in canvas pixel space at
`y ∈ [0, TILE)`. The level's row 0 is rendered at canvas
y ∈ [TILE, 2 × TILE).

Equivalently: `canvasY(r) = r * TILE + HUD_HEIGHT` where
`HUD_HEIGHT = TILE`.

**Why a band, not row 0**:
- Existing levels keep their grid layout (no migration).
- The level format is unchanged (no new directive).
- The agent's nav-graph builder is unchanged (level rows are
  the same).
- The fit-to-screen scale calc adds HUD_HEIGHT to the canvas
  height.

**Player physics**: unchanged. The player's `y` coordinate is
relative to the LEVEL grid; the renderer offsets by HUD_HEIGHT
when blitting. If the player jumps high enough to reach negative
level-y (above row 0), the player's sprite renders OVER the HUD
band — that's the "jump up into the messages row" behaviour the
user described. No collision, no death; the player just visually
overlaps the HUD.

**HUD rendering**: dark-grey rectangle (`#252526`, the existing
`--panel` colour) for the bg + light-grey text (`var(--fg)`) for
the score / status. Matches the panel chrome of the rest of the
editor; consistent with light/dark theme.

```js
function drawHud(ctx, scene) {
  // Bg strip at top of canvas.
  ctx.fillStyle = HUD_BG;       // #252526 dark / #ececec light
  ctx.fillRect(0, 0, ctx.canvas.width, HUD_HEIGHT);
  ctx.fillStyle = HUD_FG;       // matches --fg
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(scene.hudText(), 8, HUD_HEIGHT / 2);
}
```

**Click-to-paint adjustments**: `cellFromEvent` reads
`overlay.getBoundingClientRect()` and divides by the intrinsic
canvas size. With HUD_HEIGHT offset, click-y must subtract
HUD_HEIGHT before grid-cell conversion. Clicks WITHIN the HUD
band (y < HUD_HEIGHT) are NO-OPS for editor painting.

### 3.3  Renderer + PlaytestScene plumbing

| Surface | Change |
|---|---|
| `src/renderer.js` (`draw`) | Apply `translate(0, HUD_HEIGHT)` before drawing the level layers; canvas sized to `worldH + HUD_HEIGHT` |
| `src/play/playtestScene.js` | `draw()` calls `editorDraw` (which now offsets) and then renders the HUD on top via `drawHud()` |
| `src/main.js` | `cellFromEvent` accounts for HUD_HEIGHT in the y-pixel→row math |
| `src/main.js` | Editor preview canvas height = `gridH * TILE + HUD_HEIGHT` |
| `src/agent/overlay.js` | Path overlay's y coords offset by HUD_HEIGHT (the overlay canvas matches the preview canvas dims) |

The HUD bg colour reads from a new custom property
`--hud-bg` and `--hud-fg` at `:root` / `body.lightmode` —
extending the v26 var palette.

### 3.4  Edit-mode visual cue

In edit mode the HUD band shows static placeholder text
("HUD: score / status" or similar) so the designer SEES the
reserved strip and doesn't try to paint there.

In play / demo / test modes the HUD shows the live scene
text (`scene.hudText()`).

## 4. UX in detail

### 4.1  below_ground full solve

Click [Test] on below_ground.txt. Within 5 s, the dialog shows
`✓ Level completable — 1 solution`. Stats: 16 pickups, several
solutions possible. Path overlay traces the full route through
both ooo platforms to the exit.

User-invisible change: the planner uses 9-bucket nodes instead
of 3.

### 4.2  Top messages row — play mode

```
┌────────────────────────────────────────┐
│  coins: 3 / 4  →  find the exit       │  ← HUD strip (TILE px tall)
├────────────────────────────────────────┤
│                                        │
│  ........................              │  ← level row 0
│  ........................              │     starts here at
│  ........................              │     canvas y = TILE
│  ......P..........E.....               │
│  ########################              │
└────────────────────────────────────────┘
```

If the player jumps high enough (peak ≈ 4.9 cells), their
sprite renders over the HUD band — visually overlapping the
text but not interacting with it.

### 4.3  Top messages row — edit mode

The HUD band stays visible with placeholder text so the
designer can't miss it.

```
┌────────────────────────────────────────┐
│  HUD: score / status row              │  ← placeholder
├────────────────────────────────────────┤
│  ........................              │
│  ........................              │
│  ........................              │
│  ......P..........E.....               │
│  ########################              │
└────────────────────────────────────────┘
```

Click-to-paint above the HUD line is ignored; the user can
still paint level row 0 (just below the line).

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/agent/grid.js` | `xOffsetBucketOf(x)` + `X_OFFSET_BUCKETS`; `stateKey` arity 5; node identity 9× per cell; addActionEdges runs each action from each (cell, vxBucket, xOffsetBucket) start with `startState.x = c*TILE + xOffsetBucket-derived offset` |
| `src/agent/planner.js` | `cellToBucket0(k)` → 5-part stateKey; `stateKey(spawn.r, spawn.c, 0, 'L')` start (spawn lands at cell-left edge); A* prefix-match unchanged (cellKey is still 2-part) |
| `src/agent/grid.test.js` | All `stateKey(r, c, 0)` lookups → `stateKey(r, c, 0, 'L')` (or whichever bucket); helper `cellOf(k)` already strips suffix |
| `src/agent/planner.test.js` | `from` args extended to 5-part stateKey |
| `tests/v25-edge-state.spec.js` | Lookup key gains the xOffsetBucket part |
| `tests/v26-bucket-graph.spec.js` | Node count = walkable-cells × 9; helpers test xOffsetBucketOf |
| `tests/v27-bucket-graph.spec.js` (new) | xOffsetBucket logic + below_ground solves |
| `src/renderer.js` | Canvas height = `worldH + HUD_HEIGHT`; level layers translated by `(0, HUD_HEIGHT)` |
| `src/play/playtestScene.js` | `draw()` calls renderer then HUD-strip |
| `src/main.js` | `cellFromEvent` y-offset; canvas size accounts for HUD_HEIGHT; editor preview renders HUD strip via the same renderer offset |
| `src/style.css` | New vars `--hud-bg`, `--hud-fg` at `:root` + `body.lightmode` |
| `src/agent/overlay.js` | Path overlay y offset by HUD_HEIGHT |
| `tests/v27-hud-row.spec.js` (new) | HUD band exists; canvas height = worldH + TILE; click-y < TILE is no-op; HUD text renders in play mode |
| `TDDs/3_transcripts/version27_build.md` (new) | narrative |

## 6. Open questions — proposed defaults

- **HUD_HEIGHT**: `TILE` (= 20 engine px = 24 editor px). Other
  candidates: half-tile (10/12 px — too thin for 14px bold text),
  two tiles (40/48 px — uses too much canvas real estate).
  **Proposed: TILE**.
- **HUD interpretation**: (a) a dedicated canvas BAND above the
  level grid, vs (b) the level's row 0 styled as HUD with no
  collision. **Proposed: (a) BAND** — keeps level format
  unchanged and is mechanically simpler. (b) would require all
  existing levels to be migrated.
- **xOffsetBucket discretisation**: 3 thirds (L/C/R), 4 quarters,
  or 5 fifths. **Proposed: 3 thirds** — minimum viable
  resolution at TILE=20px (~6.7 px per bucket). Finer if v27
  M3 acceptance reveals more drift.
- **Below_ground budget budget headroom**: 9× graph nodes may
  exceed the 5s budget on some levels. **Proposed**: profile
  during M2; gate on the M3 regression suite. If budget-tight,
  add the optional "only enumerate physically reachable
  buckets" pruning.
- **HUD text in edit mode**: placeholder text or empty?
  **Proposed: placeholder** so the row's presence is visible.
- **Click-to-paint in HUD band**: **no-op** (proposed). User
  can't accidentally paint into the band.

## 7. Acceptance criteria

### Agent
- **`below_ground.txt` solves end-to-end** — `.badge.ok` within
  5 s; all 16 pickups collected; exit reached.
- **All v21–v26 levels continue to solve** — no regression.
- **Graph-build time** stays under 1 s on the shipped levels
  (with the 9× node count).

### HUD
- **HUD band visible** at top of canvas in both edit and play
  modes.
- **HUD text renders** the scene's HUD message in play mode
  (matches the v18 message string format).
- **Click-to-paint above the HUD line** is a no-op (no level
  cell painted).
- **Player can render OVER the HUD band** when jumping high
  (no collision, no death).

### Tests
- `npm test` green; `npx playwright test` green (existing 95 +
  ≥ 5 new cases).

## 8. Non-impact (explicit)

- **Level format glyphs + directives** — unchanged.
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved.
- **Tileset schema** — unchanged.
- **v22 multi-solution + v23 minimise + v24 multi-colour +
  v25 sub-pixel + v26 vxBucket A\*** — all unchanged; v27 adds
  xOffsetBucket as a SECOND state dimension.
- **The LOAD / theme / fit-toggle flows** — unchanged.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v28+ candidates / deferred

- **Per-frame-trajectory planner** (full 3.1.b from v25
  design) — the BIGGER architectural step if v27's 9-bucket
  approach still can't solve some levels.
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

## 10. Risks

- **9× graph nodes blow the 5 s budget** — typical 24×14 level
  with ~150 grounded cells × 46 actions × 9 buckets = ~62k sim
  runs. Mitigation: only enumerate physically-reachable buckets
  (skip the ones the player can't arrive in from current
  graph state). If still tight, reduce to 6 buckets (drop
  middle x-offset).
- **xOffsetBucket discretisation still too coarse** — at 6.7 px
  per bucket, the player's actual sub-pixel x might land near
  bucket boundaries; A* picks edges expecting a different
  bucket. Mitigation: 4 buckets (5 px each) if 3 isn't enough.
  v28 candidate: per-frame planner instead of bucketed A*.
- **Existing levels regression** — every level's nav-graph
  shape changes when node identity gains a fourth dimension.
  Mitigation: full agent-suite Playwright pass at M3 gate. If
  a level regresses, the bucket math needs tweaking.
- **HUD breaks fit-to-screen** — the v23 M4 fit-to-screen
  calculations need to account for the additional HUD_HEIGHT.
  Mitigation: extend `applyFitToScreen` to use the canvas's
  full height (level + HUD); the existing math should work
  unchanged because it reads `previewCanvas.width / height`
  which already include the HUD.
- **HUD bleeds into edit-mode interactions** — the marquee
  rect-draw tool and other overlay-canvas interactions need
  to account for the y offset. Mitigation: `cellFromEvent`
  is the single point of cell-coord computation; updating it
  covers all callers.
- **Editor-mode HUD placeholder reads as a real row** — author
  might confuse the HUD band for an actual level row.
  Mitigation: distinct dark-grey background + italic / muted
  placeholder text + a 1-px border separating the band from
  the level.
- **No deploy risk** — bundle grows ~2 KB (xOffsetBucket math
  + HUD draw helper + var defs).

## 11. Why this scope

v26 closed the cell-resolved-edge gap with vxBucket but
explicitly named the v27 starting point: "finer state buckets
(e.g. xOffsetBucket on top of vxBucket) — 9 buckets per cell
instead of 3; finer state resolution". v27 ships exactly that
plus the long-deferred top-messages-row feature so each thread
delivers something visible.

The two threads share no architectural overlap — same shape as
v22–v26 (small commits, one milestone each, agent + UX in
parallel). The big-ticket future items (minimap, slopes,
linked levels, AI level designer) remain in the v28+ candidate
pool until v27's agent thread closes the below_ground gap
cleanly.
