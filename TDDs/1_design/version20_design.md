# 2D Level Designer — Version 20 Design Document

Status: **Delivered** · Date: 2026-05-21 · Builds on:
[version19_design.md](version19_design.md) (scrolling playtest +
viewport Play Setting) · Implementation:
[../2_implementation/version20_implementation.md](../2_implementation/version20_implementation.md) ·
Transcript:
[../3_transcripts/version20_build.md](../3_transcripts/version20_build.md)

## 1. Purpose

Add an **AI level-tester** — a rule-based planning agent that
attempts to complete the current buffer's level and surfaces an
**explainable trace** of how it did (or did not) succeed.

Concretely:

1. **Test button** in the toolbar opens a modal that runs the
   agent against the live buffer and reports:
   - **CAN this level be completed** (yes / no / timed-out).
   - **How** — a goal-and-action trace ("walk right because the
     exit is east" / "jump because there's a gap of 3 tiles"),
     each entry with a `why:` string.
   - **How difficult** — `{ steps, jumps, replans, deaths }`.
2. **Demo** button replays the agent's winning input sequence in
   the live playtest — the same engine that validated the plan
   now renders it normally, so what you see is pixel-faithful to
   what the agent did.
3. **Path overlay** — when a solution is selected, the editor's
   existing `#overlay` canvas paints the agent's trajectory as a
   polyline with numbered markers at each pickup/exit in visit
   order.

v20 ships **one** shortest solution per Test run. The UI lists
solutions (a 1-item list for v20) so multi-solution enumeration
slots in cleanly for v21+.

## 2. Current state (per topic)

- **No automated level testing**. The author plays the buffer
  themselves (v18 play-in-place); validity is gated by the
  v9-era launcher gate (level must have ≥1 `P`, ≥1 `E`, no
  parse errors); reachability isn't gated at all.
- **Engine physics**: walk speed 240 px/s (12 cells/s), single
  jump from `JUMP_FORCE=560`, gravity 1600 px/s². Max jump
  height ~98 px (~5 cells); max horizontal jump distance at
  peak ~168 px (~8.4 cells). Player AABB sized to TILE=20.
- **Input**: `src/play/core/input.js` is the v9 vendored
  keyboard listener. `Game.input` exposes `.isDown(key)` and
  `.wasPressed(key)`. v20's agent needs a sibling `ScriptedInput`
  that reads from a recording.
- **Playtest scene**: `PlaytestScene.update(dt)` advances
  physics one step using `this.game.input`. Headless simulation
  reuses this directly — no draw, no canvas, no rAF.

## 3. Architecture

```
src/agent/
  sim.js       — headless PlaytestScene runner (no DOM)
  grid.js      — parsed level → nav-graph (cells + jump edges)
  planner.js   — A* over the nav-graph; produces trace + plan
  runner.js    — orchestrates: planner → sim validate → replan
  index.js     — public entry: testLevel(parsed, legend, tileset) → Solution|null

src/agentDialog.js — modal UI (mirrors loaderDialog.js / openPlaySettings shape)
src/play/scriptedInput.js — Input look-alike that reads a recording
src/play/launcher.js — gains optional { inputSource: 'keyboard'|recording } param

src/main.js  — new [Test] toolbar button (edit-only); overlay polyline rendering
src/style.css — agent-dialog rows + path-overlay colours
```

The `agent/*` modules are **pure** (no DOM imports), tested with
`node --test`. The DOM-touching bits (`agentDialog.js`, overlay
rendering, launcher input-source flag) are wired into `main.js`
in the integration milestone.

## 4. Schema additions

**None.** v20 doesn't add any header directive or `tile_lookup`
field. The agent reads the existing parsed level + legend +
tileset; the solution is in-memory only (never serialised to the
buffer).

A future v21 could persist "known-good solutions" as a
`# solutions:` block, but v20 keeps it ephemeral.

## 5. The headless simulator (`src/agent/sim.js`)

The simulator runs `PlaytestScene.update(dt)` in a tight loop
without rendering. Key shape:

```js
export function simulate({ parsed, legend, tileset, recording, maxFrames = 600 }) {
  const fakeGame = {
    input: new ScriptedInput(recording),
    assets: { play() {} },          // coin-pickup sound is a no-op
  };
  const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
  scene.enter();
  for (let frame = 0; frame < maxFrames; frame++) {
    fakeGame.input.advance(frame);
    scene.update(1 / 60);
    if (scene.phase === 'won')  return { outcome: 'won',  frame, score: scene.score };
    if (scene.phase === 'dead') return { outcome: 'dead', frame, pos: { x: scene.player.x, y: scene.player.y } };
  }
  return { outcome: 'timeout', frame: maxFrames, pos: { x: scene.player.x, y: scene.player.y } };
}
```

`maxFrames=600` = 10 seconds of in-game time, which simulates in
**~50ms** of wall-clock on a modern laptop. The agent uses this
to validate candidate plans cheaply.

**Determinism**: the engine is dt-based (1/60 here) and pure
floating-point arithmetic; same input sequence → same output.
The simulator's `assets.play()` is a no-op so it's safe to run
many times without browser-side audio glitches.

## 6. The nav-graph (`src/agent/grid.js`)

Each empty cell (`.`) becomes a node. Edges between nodes are
typed:

- **walk**: horizontal neighbours on the same supporting row
  (both must be standing on a `#`).
- **drop**: a cell that's `.` and falls (no support below).
  Walking off an edge produces a drop arc — modelled as a
  multi-cell edge ending where the player lands.
- **jump**: a parameterised arc. From a grounded `.` cell, the
  agent knows the engine's `JUMP_FORCE=560` / `GRAVITY=1600` /
  `SPEED=240`. We pre-compute the **reachable jump set** per
  ground cell — for v20, hard-coded as cells within ~8 horizontal
  cells and ~5 vertical cells, gated by line-of-flight collision
  checks (no `#` along the parabolic path).

```js
buildNavGraph(grid, legend) → {
  nodes: Map<"r,c", { r, c, supported: boolean }>,
  edges: Map<"r,c", Array<{ to: "r,c", kind, cost, mid?: Cell[] }>>,
}
```

The `mid?` field is the intermediate cells the player passes
through (used by the overlay's polyline). `cost` is in frames
(walk: 1 cell/12-frames-at-60fps ≈ 5 frames; jump: ~42 frames
for the full arc).

## 7. The planner (`src/agent/planner.js`)

Top-level goal: **win** (= touch an `E` cell, with
`# pickup-required:` satisfied).

Goal stack:

```
WIN
└── (if pickup-required > 0 or 'all') collect-pickups
│   └── for each required pickup, in nearest-first greedy order:
│       └── reach-cell(p)
│           └── A*(player-position, p)  ── produces walk+jump+drop edges
└── reach-cell(exit)
    └── A*(current, exit)
```

**Trace entry shape** (per edge in the A* result):

```js
{
  kind: 'walk' | 'jump' | 'drop' | 'wait' | 'collect' | 'exit',
  target: { r, c },           // where this action ends
  why: string,                // 'reach pickup #2 at (5,8)' / 'gap of 3 tiles' / etc
  frameRange: [start, end],   // for the demo + difficulty stats
}
```

**Greedy pickup ordering** for v20: at each pickup-selection
step, pick the unvisited pickup with the shortest A* cost from
the current position. Optimal-tour (TSP) is a v21+ candidate.

## 8. The runner (`src/agent/runner.js`)

Orchestrates planner + simulator with a replan budget:

```js
export function testLevel(parsed, legend, tileset, opts = {}) {
  const budget = opts.replanBudget ?? 3;
  let plan = planner.plan(parsed, legend);
  for (let attempt = 0; attempt < budget; attempt++) {
    const recording = planToRecording(plan);
    const sim = simulate({ parsed, legend, tileset, recording });
    if (sim.outcome === 'won') {
      return { ok: true, plan, recording, stats: { ...sim, attempts: attempt + 1 } };
    }
    // Sim says the plan didn't complete. Update the planner's
    // knowledge: mark the failing edge as risky, replan.
    plan = planner.replan(plan, sim);
  }
  return { ok: false, lastSim: /* last failed simulation */, plan };
}
```

**`planToRecording`** walks the trace, converting each edge into
frame-indexed key-state changes (`{ frame, key, down }`).
**`planner.replan`** marks the edge where physics failed (e.g. a
jump that didn't clear) as "blocked" and re-runs A* with that
edge cost = ∞.

## 9. The UI

### 9.1  `[Test]` toolbar button

Added between `[Play]` and `[Play Settings]`, with the
`.edit-only` class (mirrors the v18 pattern — hidden during play
mode).

### 9.2  Test dialog

Opens on click. While the agent runs (≤3 seconds budget), shows
a "Searching…" message. When complete:

**Success state:**

```
✓ Level completable

Solution 1 — 47 steps · 3 jumps · 1 replan
                                          [Demo this route]

▾ Trace
  ⓘ walk_right(4)  — exit is east             frames 0–20
  ⓘ jump          — gap of 2 tiles ahead     frames 20–62
  ⓘ collect       — pickup #1 at (5,8)       frame 65
  …
```

**Failure state:**

```
✗ No solution found within budget

The agent's last reachable cell was (14, 5). Path to the exit
at (28, 5) was blocked by a hazard band at column 17.
                                                    [Close]
```

### 9.3  Path overlay

When a solution is selected (v20: auto-selected, it's the only
one), the editor's `#overlay` canvas paints:

- A **polyline** through the player's centre per trace entry,
  in `#ffcc00` (warm yellow).
- **Numbered markers** at each pickup the agent collects (1, 2,
  3 in visit order) and at the exit (E).
- A **start marker** at the player spawn (S).

The overlay paints whenever the dialog is open with a selected
solution. Closing the dialog clears the overlay. The marquee-
select rect is gated off while the test overlay is up
(equivalent to play-mode pointer-events: none).

### 9.4  Demo

`[Demo this route]` flips the editor into a special **demo
mode** — like play mode (`body.playmode`), but `Input` reads from
the recording instead of the keyboard. The toolbar swaps to a
single `[Stop Demo]` (== Esc) button. The agent's plan plays out
visually; when it reaches `phase === 'won'` (or the player
dies), the demo holds the win/lose banner for ~1.5s then auto-
exits back to edit mode.

## 10. Open questions — proposed defaults

- **Search timeout** — proposed **3 seconds**. Most levels < 50ms.
  Pathological levels get the "No solution found" path.
- **Frames per simulated second** — proposed **60** (= `dt=1/60`).
  Matches the live engine's typical browser cadence; the engine
  is dt-based so this only affects the recording resolution.
- **Path-overlay style** — proposed solid polyline + numbered
  circles. Alternatives: dotted line (less visual weight);
  cell-tinted (every visited cell coloured). Polyline is the
  cleanest read on dense levels.
- **Demo can be cancelled?** — proposed **yes**, Esc cancels
  back to the dialog (not to edit mode); the user can pick
  another route (or replay) without re-running the agent.
- **What if the agent doesn't know about decoration / foreground
  glyphs?** — they're inert in playtest (v18 §3.3), so the
  agent treats them as empty cells. No physics impact, no
  pathfinding impact.
- **What if the level has multi-row hazards or unusual layouts?**
  — A* respects exact cell semantics: any `^` in a candidate
  path is an infinite-cost edge. The agent steers around it.

## 11. Acceptance criteria

- **Solvable level** (Dirt default tutorial): Test → "Level
  completable", a single solution with a sensible step count
  (< 100 for the default), Demo plays it out, polyline overlay
  matches the player's actual path.
- **Pickup-required level**: with `# pickup-required: 2` and 3
  pickups on the map, the agent visits exactly 2 pickups before
  the exit; the trace records the order with `why:` strings.
- **Unreachable exit** (e.g. exit walled off): "No solution
  found", overlay shows the last reachable cell in red, the
  diagnostic names the blocking column / row.
- **Hazard-bordered path**: agent steers around — the polyline
  doesn't cross any `^` cell.
- **Demo replay**: pressing Demo loads the recording into a
  `ScriptedInput`, the player visibly walks/jumps the plan,
  reaches the exit, win banner shows.
- `npm test` green; `npx playwright test` green.

## 12. Non-impact (explicit)

- **Level format glyphs** — unchanged.
- **Tileset schema** — unchanged.
- **All v18 + v19 directives** (`# tileset:`,
  `# background-image:`, `# pickup-required:`, `# viewport:`) —
  unchanged.
- **The vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical, v9 §7 invariant preserved. `Game`, `Input`,
  `PlaytestScene` are all reused as-is.
- **The v19 camera + scrolling playtest** — unchanged. The agent
  runs headless without camera concerns. Demo mode honours the
  level's `# viewport:` setting (camera follows the agent-
  driven player just like a human one).
- **Editor preview / legend / problems bar / toolbar layout** —
  unchanged except for the new `[Test]` button.

## 13. Path-overlay reusability

The polyline + marker rendering is purposely a separate function
(`src/agent/overlay.js`) so v21+ can use it for:

- Multi-solution selection (each solution rendered in a
  different colour).
- Author-mode hints ("the player can reach here in N steps").
- A future "replay file" feature (load a recorded run from
  disk and render it).

## 14. Non-goals + v21+ candidates

- **Multi-solution enumeration** — locked for v21. The list UI
  is built ready; the planner gains a "find K best routes" path.
- **TSP-optimal pickup ordering** — greedy nearest-first is fine
  for v20; optimal-tour is v21.
- **Learning physics empirically** — v20 hard-codes from
  `constants.js`. A future agent could probe the engine for its
  own jump/walk reach.
- **Backtracking around walls** — v20's A* respects the nav-
  graph but uses simple goal ordering; complex backtracks
  (collect-a-key-then-return) need v22+.
- **Author-difficulty rating** — composite score from
  `{ steps, jumps, replans, deaths }`. Maybe a colour-coded
  "DIFFICULTY: ★★☆☆☆" in the dialog. Polish.
- **Multi-level path** (with v20+ doors / tunnels feature) —
  cross-level agent. Far-future.
- **Per-tileset agent capabilities** — different player sprites
  could have different jump heights one day; the agent reads
  from constants today.
- All v18+v19 long-standing carry-overs — still pending (camera
  damping, parallax, decoration-image placement, layered
  z-order, etc.).

## 15. Risks

- **Replan thrashing on edge-case levels.** If the planner
  keeps proposing variants that all fail, the budget caps it at
  3 attempts. Total runtime ≤ 3 × ~50ms + UI ≈ 200ms — well
  under the 3-second user-facing budget.
- **Floating-point drift across the engine's `dt` integration**:
  the engine clamps `dt` to `1/30` max (Player.update header
  comment). Our `dt=1/60` is well under that, but on a slow
  device a real playthrough might use larger `dt`s and produce
  different physics. Mitigation: the simulator is the ground
  truth for the agent's plan; if a Demo replay diverges, it
  means the runtime is sluggish enough to slow-mo physics —
  the agent's plan was correct for the canonical 60 fps engine.
- **Recording → replay timing drift.** `ScriptedInput.advance
  (frame)` increments on each simulator tick; in the live demo,
  it should advance on each `update(dt)` call (one per rAF
  frame). As long as the live engine ticks at ≥60 fps, the
  replay matches the simulation.
- **A* state explosion on huge worlds.** For the v8 200×200 max
  level, the nav-graph has 40k nodes. A* on that is fine
  (≤100ms), but a future "all paths" enumeration would need
  pruning. v21 problem.
- **No deploy risk.** Bundle grows by ~5KB (agent + dialog).
  Pages workflow unchanged.

## 16. Why this design (the explainable-WHY answer)

The wishlist's key constraint was:

> use rule-based goal/planning/agenda — so there is an history
> log that explains WHY the agent took certain paths — so could
> become a guide to how to complete the level for the user

v20 honours this by:

1. **Rule-based** — A* + greedy ordering, no machine learning, no
   neural model. Every decision is traceable.
2. **Goal/planning/agenda** — the goal stack is an explicit data
   structure (WIN → collect-pickups → reach-cell → walk/jump).
   Each subgoal carries its parent reference, so the trace can
   render the hierarchy.
3. **History log explains WHY** — every trace entry has a `why:`
   string filled in at planning time, not post-hoc. Examples:
   - `"reach pickup #2 at (5,8)"` — comes from the pickup-
     ordering step.
   - `"gap of 3 tiles ahead"` — comes from the A* edge type
     (walk-edge would have been chosen if there was a floor).
   - `"avoid hazard at (10,5)"` — comes from the A* edge
     pruning step.
4. **Guide for the user** — the dialog renders the trace as a
   bulleted list with frame ranges; the path-overlay paints the
   same trace as a polyline. Together they answer "how do I
   solve this level?" in two complementary modes (textual +
   visual).
