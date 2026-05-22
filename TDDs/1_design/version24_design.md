# 2D Level Designer — Version 24 Design Document

Status: Proposed · Date: 2026-05-22 · Builds on:
[version23_design.md](version23_design.md) (editor polish + agent
action-graph extensions) · Implementation: *to follow once this scope
is approved*.

## 1. Purpose

A polish + agent-investigation version. Three small concrete items
the user surfaced in the v23 wishlist tidy, plus the v22→v23 agent
carry-overs (`tutorial.txt`, `below_ground.txt`, `precision_landing`).

### Thread A — Polish

1. **Pickup-touch sound timing fix.** When the player touches a
   pickup in Play / Test, the pickup disappears IMMEDIATELY but the
   collect sound fires a beat later. The disconnect breaks the
   audio↔visual sync the user expects.
2. **`prefers-color-scheme` first-load default.** v23's 🌗 toggle
   defaults to dark for backward compatibility, but a first-time
   visitor on a light-mode OS should land on light. Read the media
   query when there's no `v23.theme` localStorage entry yet.
3. **Multi-coloured path overlay.** When the agent finds ≥ 2
   solutions, render EACH on the overlay simultaneously in a
   distinct hue, with the focused one solid + others dimmed.
   Long-standing v22 carry-over.

### Thread B — Agent carry-overs

4. **`tutorial.txt` solves.** v23 diagnosed this as level-geometry,
   not action-graph. Two fix paths to weigh (see §3.4 + Open
   Questions §6).
5. **`below_ground.txt` solves.** Dies at frame 49 — re-investigate
   under the v23 action set; may share root cause with the
   spawn-fall settle.
6. **`precision_landing` rule.** The third item from v23's action-
   graph plan that didn't land: accept edges where the action's
   trajectory passes within ±2 px of a 1-tile target's centre.
   Needed for cherry-on-pillar (1-tile platform) variants the
   v22 tower-cherry sidestepped by being 3 wide.

## 2. Current state

### Sound (v18+)
- `scene.game.assets.play('coin')` fires from inside the player's
  pickup-collision branch in `PlaytestScene.update()`.
- Suspected one-frame delay: the audio context's `start()` schedules
  asynchronously; the visual update happens this frame, the audio
  the next render tick.

### Theme (v23 M2)
- `body.lightmode` re-binds five CSS custom properties.
- First-load default = `'dark'` (hardcoded in `readEnumPref`).
- localStorage key: `v23.theme`.

### Path overlay (v22 M3)
- `renderSolutionOverlay(octx, solution, tile)` paints a single
  polyline + per-action markers for the focused solution.
- The overlay clears + redraws on every `focusSolution()` call.

### Agent (v23 M6)
- Action set: 46 candidates per grounded cell (28 v21 + 8 drop_release
  + 10 run_off).
- `tutorial.txt`: still "Exit unreachable from spawn". v23 transcript
  documented the level-geometry diagnosis.
- `below_ground.txt`: dies at frame 49.

## 3. Architecture

### 3.1  Pickup-touch sound timing

Hypothesis: the lag is between the pickup-collision detection
(`scene.update`) and the audio play call (`scene.game.assets.play`),
plus the audio context's start-time scheduling. Three potential
fixes to investigate in order:

1. **Move the play() call EARLIER in the frame.** If it currently
   fires after the score increment + visual-state change, move it
   to fire BEFORE — same JS tick, but audio context gets an earlier
   `currentTime` reference.
2. **Pre-warm the audio context.** On first user interaction
   (Play / Test click), call `audioContext.resume()` so the
   first `play()` doesn't pay the resume latency.
3. **Use a pre-decoded `AudioBuffer`** instead of an `<audio>`
   element — `AudioBufferSourceNode.start(0)` has sub-millisecond
   latency, whereas `<audio>.play()` can have a tens-of-ms delay.

Plan: instrument with `performance.now()` in M1; pick whichever
the data points at; implement.

### 3.2  `prefers-color-scheme` first-load default

`src/main.js`, where `theme` is initialised:

```js
let theme = readEnumPref('v23.theme', defaultTheme(), ['dark', 'light']);

function defaultTheme() {
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch { /* matchMedia unavailable */ }
  return 'dark';
}
```

If the user has clicked 🌗 once (localStorage set), their choice
wins. Otherwise the OS preference seeds the initial state. A
`window.matchMedia(...).addEventListener('change', ...)` listener
could update the live theme when the OS pref flips, but proposed
default: respect the OS pref ONLY on first load — once the user has
interacted, lock to their choice.

### 3.3  Multi-coloured path overlay

`src/agent/overlay.js` gains a multi-solution variant:

```js
export function renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile) {
  // Draw non-focused solutions first, dimmed.
  for (let i = 0; i < solutions.length; i++) {
    if (i === focusedIdx) continue;
    renderSolutionOverlay(ctx, solutions[i], tile, {
      colour: HUE_PALETTE[i % HUE_PALETTE.length],
      alpha: 0.35,
    });
  }
  // Then the focused one, full opacity, on top.
  renderSolutionOverlay(ctx, solutions[focusedIdx], tile, {
    colour: HUE_PALETTE[focusedIdx % HUE_PALETTE.length],
    alpha: 1.0,
  });
}
```

`HUE_PALETTE` = 5 high-contrast HSL values (one per max-solutions
cap). The existing `renderSolutionOverlay` gains an optional
`{colour, alpha}` parameter; defaults preserve v22 behaviour.

`src/main.js`'s `onResult` callback dispatches to the multi-renderer
when `result.solutions.length > 1`, else the single renderer.

### 3.4  `tutorial.txt` solves

Two competing fixes; choose ONE for v24:

#### 3.4.a — Level redesign (proposed)

Add an intermediate stepping stone at row 2 or row 3, around cols
12–17, bridging the ooo platform to the exit:

```
Row 0: ########################
Row 1: #......................#
Row 2: #...P.......##....E....#   ← NEW row-2 platform cols 12–13
Row 3: #...........##...######    ← supports it
Row 4: #.......oooo...........#
Row 5: #......######..........#
Row 6: #......................#
Row 7: #..........^^^.........#
Row 8: #......................#
Row 9: ########################
```

Pros: zero engine change; preserves v9 §7 invariant; level becomes
self-consistent (player physics matches the route).

Cons: changes shipped content. Users with the existing level state
will see the new shape.

#### 3.4.b — Double-jump engine extension (alternative)

Add a second `wasPressed("space")` allowance per jump cycle. Player
can press space MID-AIR once for a second vy = -JUMP_FORCE.

Pros: opens many existing levels (not just tutorial); a richer
gameplay mechanic.

Cons: **breaks v9 §7 invariant** — `src/play/entities/player.js`
is vendored byte-identical from simple-platformer-1@4c3b936.
Modification needs explicit user approval + a transcript note.
Agent action enumeration would also need a new `jump_double` type
covering the two-press combinations (~50 new candidates).

**Proposed default: 3.4.a.** Smaller change, no invariant breakage,
single-level scope. The double-jump idea moves to a v25+ candidate
list pending user decision.

### 3.5  `below_ground.txt` re-investigation

Trace the agent's failure with a diagnostic Playwright probe (same
style as v23's _v23-graph-probe scratch tests). Two hypotheses to
test:

- The spawn-fall settle (v22 M1) sends the player THROUGH a
  hazard cell during the gravity-only ticks. Fix: hazard collision
  checks in the no-input settle loop.
- The starting cell (after settle) is adjacent to a hazard that
  the first walk/jump action steps into. Fix: planner heuristic
  to avoid hazard cells.

Implementation depends on which hypothesis lands. M5 ships either
the engine-side hazard-aware settle OR the agent-side hazard-
avoiding planner.

### 3.6  `precision_landing` rule

`src/agent/grid.js`'s `addActionEdges` extended:

```js
// After the cell-resolved edge is decided, also check trajectory
// for ±2 px passes over targets.
if (result.trajectory) {
  for (const target of precisionTargets) {
    for (const pt of result.trajectory) {
      const tcx = target.c * TILE + TILE / 2;
      const tcy = target.r * TILE + TILE / 2;
      const dx = Math.abs(pt.x + TILE / 2 - tcx);
      const dy = Math.abs(pt.y + TILE / 2 - tcy);
      if (dx < 2 && dy < 2) {
        edgesArr.push({
          to: cellKey(target.r, target.c),
          ...
        });
        break;
      }
    }
  }
}
```

Requires `simulateActionInContext` to also return the per-frame
trajectory (currently only end-state). Performance: each cell ×
46 actions × ~30-60 frames per action × ~10 targets = ~10k
distance checks per graph build for a typical level. Cheap.

`precisionTargets` = `pickupCells ∪ exitCells`, computed once per
buildNavGraph call.

## 4. UX in detail

### 4.1  Pickup sound

User-visible: pickup collect feels snappier. No new UI.

### 4.2  Theme first-load

First-time visitor on a light-mode OS sees the light theme
immediately. No flicker (the theme is applied synchronously at
module init before first paint).

### 4.3  Multi-coloured overlay

```
       focused (S1) — solid yellow  ━━━●━━━●━━━
                  S2 — dimmed cyan    ╴╴╴○╴╴╴○╴╴╴
                  S3 — dimmed magenta ┄┄┄◇┄┄┄◇┄┄┄
```

Click a non-focused row in the dialog → that solution becomes the
solid one, others fade to dim. Helps the user compare routes
visually without flipping back and forth.

### 4.4  Tutorial fix

Either:
- (4.a) the shipped `tutorial.txt` now has visible row-2/3 platforms
  bridging the gap; the agent solves it; the player can complete it.
- (4.b) double-jump enabled — user holds space in air for a second
  burst.

### 4.5  `below_ground.txt` fix

After the diagnostic + repair, the agent solves the level (or
documents a specific further failure for v25).

### 4.6  Precision landing

User-invisible — the agent just reaches 1-tile pickups it couldn't
before. Future levels can use narrower platforms.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/play/playtestScene.js` (or `assets.js`) | Pickup sound timing fix per M1 investigation. Possibly switch to AudioBufferSourceNode. |
| `src/main.js` | `prefers-color-scheme` seeds first-load theme; multi-solution onResult dispatches to renderAllSolutionsOverlay. |
| `src/agent/overlay.js` | `renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile)`; existing `renderSolutionOverlay` gains optional `{colour, alpha}` params (back-compat). |
| `public/data/levels/tutorial.txt` | Add intermediate platform (3.4.a route). |
| `src/play/playtestScene.js` / `src/agent/planner.js` | `below_ground.txt` fix per M5 investigation. |
| `src/agent/simAction.js` | Return per-frame `trajectory: [{x, y}, ...]` so grid.js can do precision-landing checks. |
| `src/agent/grid.js` | `addActionEdges` extended with precision_landing rule. |
| `tests/v24-pickup-sound.spec.js` (new) | Asserts sound fires within N ms of pickup. |
| `tests/v24-theme-os-default.spec.js` (new) | Mocks matchMedia; asserts theme matches OS pref on first load + localStorage wins after. |
| `tests/v24-multi-overlay.spec.js` (new) | Snapshot the overlay with ≥ 2 solutions; assert non-focused-row alpha < focused. |
| `tests/v24-tutorial-solves.spec.js` (new) | The acceptance gate from v23 carried forward; tutorial.txt now solves. |
| `tests/v24-below-ground.spec.js` (new) | Acceptance: below_ground.txt solves. |
| `tests/v24-precision-landing.spec.js` (new) | 1-tile pickup midway between two grounded cells is reachable. |

## 6. Open questions — proposed defaults

- **Tutorial fix path**: proposed **3.4.a (level redesign)**.
  Smaller change, no v9 §7 invariant breakage. 3.4.b (double-jump)
  needs explicit user approval and moves to a separate v25 candidate.
- **prefers-color-scheme listener**: proposed **first-load only**.
  Once the user has clicked 🌗, lock to their choice; don't reactively
  flip on OS-pref changes during a session.
- **Multi-colour palette**: proposed 5 HSL values
  `{yellow, cyan, magenta, lime, orange}` — high-contrast on both
  themes. Tunable post-ship.
- **Pickup-sound fix mechanism**: proposed **investigate first, fix
  the smallest thing that closes the gap**. M1 starts with the
  cheapest fix (call-order); escalates to AudioBufferSourceNode only
  if the gap survives.
- **`below_ground.txt` scope**: proposed **investigate + ship the
  diagnosed fix in M5**, even if it requires a touch of agent
  heuristic. If unfixable in v24 scope, document for v25.

## 7. Acceptance criteria

### Polish
- **Pickup sound** fires within 50 ms of the visual disappear (or
  the gap is at minimum imperceptible by ear).
- **Theme** matches OS pref on first load (no localStorage entry);
  user choice wins on every subsequent load.
- **Multi-coloured overlay** paints all solutions when ≥ 2;
  focused-row click swaps which is solid.

### Agent
- **`tutorial.txt` solves** — `.badge.ok` within 5 s; ≥ 4 pickups
  collected.
- **`below_ground.txt` solves** — `.badge.ok` within 5 s.
- **`precision_landing`** — agent reaches a 1-tile pickup wedged
  between two walls in a unit-test level.

### Tests
- `npm test` green; `npx playwright test` green (existing 53 + ≥ 5
  new cases).

## 8. Non-impact (explicit)

- **Tileset schema** — unchanged (v22.1's `imageLocked` ships
  as-is).
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical UNLESS the user opts into 3.4.b (double-jump).
  Proposed default is 3.4.a, which keeps the invariant.
- **v18+ play-mode toolbar / problems bar / legend layout** —
  unchanged.
- **v22 multi-solution enumeration + v23 minimise** — unchanged;
  multi-colour overlay augments the rendering, doesn't change
  the data flow.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v25+ candidates / deferred

- **3.4.b — double-jump engine extension** (if user wants 3.4.a
  to ship in v24, double-jump becomes a v25 candidate).
- **Reactive theme listener** — respond to OS-pref flips
  mid-session.
- **Viewport guide follows mouse** — drag-to-pan the v23 guide.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence** — long-standing.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles** (engine change).
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.

Plus the long-standing v16/v17/v18/v19 carry-overs.

## 10. Risks

- **Pickup-sound fix lands but the perceived lag remains** — the
  delay might be in browser audio scheduling, not in our code.
  Mitigation: instrument with `performance.now()` in M1 to
  characterise the gap before picking a fix; report findings even
  if no fix lands.
- **OS-pref listener leak** — adding the change-listener in M2
  without removing it on (hot-)reload could leak listeners. v24
  ships first-load-only (no listener) to avoid this.
- **Multi-colour palette readability** — too many similar hues =
  noisy overlay. Cap at MAX_SOLUTIONS = 5 (same as v22's runner).
- **Tutorial level edit affects authored content** — users who
  copied `tutorial.txt` to a local file see the OLD shape until
  they re-load. Mitigation: edit only the shipped file; users with
  their own copies are unaffected.
- **below_ground.txt fix touches the planner** — risk of regressing
  v21/v22 solvable levels. Mitigation: full agent-suite Playwright
  pass before shipping; add the new level as a passing case.
- **Precision-landing trajectory data inflates simAction memory** —
  each sim returns up to ~60 `{x, y}` points × 46 actions × ~300
  cells = ~830k points per graph build. ~13 MB. Mitigation: only
  collect trajectory when `precisionTargets` is non-empty; cap
  point count to one sample every N frames.

## 11. Why this scope

v23 closed the editor-polish thread and started — but didn't finish
— the agent-action-graph thread. v24 finishes it (`tutorial.txt`,
`below_ground.txt`, `precision_landing`) and lands three small
polish items the user surfaced during v23 (pickup sound, OS theme
default, multi-colour overlay).

No grand new feature — same discipline as v22/v23: small, scoped,
gated. The big-ticket items (slopes, multi-level linking, AI level
designer) stay in the v25+ candidate pool until the agent's "can
solve every shipped level" thread closes cleanly.
