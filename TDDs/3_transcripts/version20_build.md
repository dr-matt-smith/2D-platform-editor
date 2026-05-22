# Transcript — Version 20: AI Level-Tester Agent

A narrative record of the v20 phase: a rule-based planning agent that
attempts to complete the current buffer's level and surfaces an
**explainable trace** of how it did (or did not) solve it. The
wishlist's key constraint was a history log that explains WHY the
agent took each path "so it could become a guide to how to complete
the level for the user". v20 honours that with A* + a greedy goal
stack and per-edge `why:` strings filled at planning time, plus a
Demo replay that visibly drives the live playtest with the agent's
recorded keypress sequence.

## The brief

User picked it from a four-option menu after v19 shipped:

> What should v20 ship? → AI level-tester agent.

The original wishlist note (`__temp/wish_list.md`):

> automated level testing
>   - can we write a basic AI, to attempt to complete each level
>     - use rule-based goal/planning/agenda
>       - so there is an history log that explains WHY the agent took
>         certain paths
>         - so could become a guide to how to complete the level
>           for the user
>   - key things are
>     - CAN the level be completed at all
>     - how DIFFICULT is the level to complete

Plus a follow-up question on the headless simulation and a request
to see the agent **demonstrate** solutions — and "each solution, if
multiple solution routes through the level are found".

The locked v20 scope:

- One shortest solution per Test run (multi-solution → v21).
- List + Demo + path-overlay UI (so v21 multi-solution slots in
  without UI rework).
- Headless `PlaytestScene.update(1/60)` loop as the validation
  backbone; engine byte-untouched.
- Schema-zero — solutions are in-memory only.

## The shape of the work

Six small commits, one milestone each, in dependency order:

| M | Commit | Deliverable |
|---|--------|-------------|
| 1 | `75fbb58` | `src/play/scriptedInput.js` (Input look-alike, recording-driven) + `src/agent/sim.js` (headless PlaytestScene runner) + 11 unit cases including walk-to-exit smoke, pit/spike kills, pickup behaviour, jump-trajectory proof |
| 2 | `b5505a0` | `src/agent/grid.js` — nav-graph with walk/drop/jump edges; reach envelope derived from `SPEED=240` / `JUMP_FORCE=560` / `GRAVITY=1600` constants (8h × 4v cells); 11 unit cases |
| 3 | `1ba3691` | `src/agent/planner.js` — A* + greedy pickup ordering + explainable trace + `replan()` for edge-blocked retry; 11 unit cases |
| 4 | `e51783b` | `src/agent/runner.js` + `index.js` — plan/sim/replan orchestrator with budget=3; 5 unit cases; planner fix (frame starts at 1 to give the player a settle tick) |
| 5 | `200f538` | UI: `[Test]` toolbar button + `src/agentDialog.js` modal + `src/agent/overlay.js` polyline-and-markers renderer + launcher's optional `inputSource` for demo mode + `body.demomode` CSS class with warm-yellow stage glow |
| 6 | _this commit_ | `tests/agent-test-button.spec.js` (4 e2e cases) + v20 transcript + design + impl Delivered |

Outcome: 217 → 257 unit tests (+40: ScriptedInput/sim 12, grid 11,
planner 11, runner 5, plus 1 free from refactor). Playwright 6 → 7
(new agent-test-button spec). Both builds clean throughout. The
vendored engine TILE/SPEED/JUMP_FORCE/GRAVITY untouched; the v9 §7
invariant holds across all six commits.

## The "headless simulation" architectural call

The validation backbone of the agent is the `simulate()` function in
`src/agent/sim.js`. It:

```js
const scene = new PlaytestScene(fakeGame, parsed, legend, tileset, () => {});
scene.enter();
for (let frame = 0; frame < maxFrames; frame++) {
  fakeGame.input.advance(frame);
  scene.update(1 / 60);
  if (scene.phase === 'won')  return { outcome: 'won', frame, score, pos };
  if (scene.phase === 'dead') return { outcome: 'dead', frame, score, pos };
}
```

`fakeGame = { input: new ScriptedInput(recording), assets: { play() {} } }`.
`PlaytestScene` reads only those two fields from `game` (`game.input`
in `Player.update`; `game.assets.play('coin', …)` for the coin sfx).
No canvas, no rAF, no rendering. 10 seconds of in-game time simulates
in ~50ms wall-clock.

The user asked specifically: "can you explain the headless simulation?
I'd like to see the agent demonstrating how to complete the level".
The headless sim is the engine running blind — finding a winning
keypress sequence cheaply. Once found, the same engine renders it
normally in Demo mode (driven by `ScriptedInput(recording)` instead
of the keyboard). The demo is pixel-faithful to what the agent did
internally, because the **same** engine ran both.

Three things had to be true for this to work:

1. **The engine had to be re-entrant.** Multiple PlaytestScene
   instances must coexist. They do — there's no shared state in the
   vendored `Player`, `Scene`, `Game`, `Input`. Each instance owns
   its own AABBs and velocity.
2. **`ScriptedInput` had to be byte-equivalent to `Input` in shape.**
   Both expose `isDown(key)` / `wasPressed(key)` / `endFrame()` /
   `dispose()`. The engine uses duck-typing — `Player.update` reads
   `scene.game.input.isDown('left')` without knowing or caring
   which class it is.
3. **The recording had to be deterministic.** Given the same
   `recording` array, every call to `simulate()` produces identical
   frame-by-frame output. The engine's floating-point integration is
   pure (no `Math.random`, no `Date.now()`), and `ScriptedInput` is
   pure too.

## The agent's reach envelope

The user wanted explainability. The starting point for explainable
pathfinding is: what *can* the agent reach in one step?

Physics constants (`src/play/constants.js`):
- `SPEED = 240` px/s (= 12 cells/s at TILE=20)
- `JUMP_FORCE = 560` (initial upward velocity)
- `GRAVITY = 1600` px/s²

Derived reach:
- Full jump arc time: `2 * JUMP_FORCE / GRAVITY = 0.7s`
- Max horizontal jump distance: `SPEED * 0.7s = 168 px = 8.4 cells`
- Max vertical jump height: `JUMP_FORCE² / (2 * GRAVITY) = 98 px = 4.9 cells`

Rounded down for safety: **8 cells horizontal × 4 cells vertical**.
These constants are recomputed in `grid.js` from the imported engine
values — no hand-tuning, so if upstream changes the jump tuning, the
agent's reach updates mechanically.

## The greedy goal stack

Top-level goal: **win** = touch an `E` cell, with `# pickup-required:`
satisfied.

Sub-goals:

```
WIN
└── (pickup-required = 'all') visit every pickup
│   └── greedy nearest-first by A* cost from current position
│       └── reach-cell(p)
│           └── A*(player-pos, p) → walk/jump/drop edges
└── reach-cell(exit)
    └── A*(current, exit)
```

Greedy nearest-first works well enough for v20's demo levels. The
TSP-optimal ordering (try every pickup permutation, keep the
shortest) is in `plan.js`'s "v21 candidates" list — straightforward
to slot in once the planner returns multiple solutions.

## The `why:` strings

The wishlist's "explainable WHY" constraint is honoured by filling
the `why:` field at planning time, not post-hoc:

```js
walk_right → "walk right toward exit at (12,3)"
jump_left  → "jump left toward pickup #2 at (5,8)"
drop_right → "drop right toward exit at (15,7)"
```

`subgoalName` ("exit at (12,3)" / "pickup #2 at (5,8)") comes from
the goal queue; the edge kind ("walk", "jump", "drop") comes from
the nav-graph edge type. They're composed by `whyForEdge(edge,
subgoalName)` — a one-line lookup, but the trace's strings are
the user-facing explanation in the dialog.

The dialog renders the trace as a collapsible `<ol>` with
frame-range prefixes ("0–5: walk right toward pickup #1 at (3,1)").
The Demo button replays the recording so the user can watch the
same plan execute.

## The path overlay

`renderSolutionOverlay(ctx, solution, tile)` paints onto the
existing `#overlay` canvas (sibling to `#preview`, already there
for the marquee selection rect):

- **Polyline** through cell centres from `graph.start` → each
  trace entry's `target`. Warm yellow (`#ffcc00`), rounded joins
  and caps, 3 px thick.
- **Numbered markers** from `goals[]` (in visit order): `S` at
  spawn (blue, `#3498db`), `1` / `2` / `3` at each pickup (warm
  yellow), `E` at exit (green, `#2ecc71`). Each marker is a
  filled circle with a dark border and a bold label.

The overlay paints only while the dialog is open; closing the
dialog clears it via `octx.clearRect(0, 0, overlay.width,
overlay.height)`.

## Demo mode

Demo flips the editor into a new state — `editorMode = 'demo'` —
adjacent to `'play'`. The toolbar swaps to the same Restart/Exit
buttons play mode shows (via the `.play-only` class, which the
new `body.demomode` selector also activates). The canvas gains a
warm-yellow 2 px inset glow on its `.stage` wrapper so the user
can tell at a glance "this is a recording, not me".

`tryPlaytest(opts)` now takes an `opts` parameter; when
`opts.inputSource` is the recording array, the launcher
instantiates `ScriptedInput(recording)` instead of `Input()`. The
engine's PlaytestScene reads input identically via duck-typing.
A parallel `requestAnimationFrame` tick advances ScriptedInput's
frame counter (the vendored Game's update loop is dt-based,
not frame-counted — keeping engine code untouched means we
drive frame events from the launcher).

When the scene's phase transitions to `won` or `dead`,
`startDemoAutoExitWatcher` (a 100 ms poll on
`playController.getPhase()`) schedules `exitPlaytest()` after a
1.5 s banner hold. Esc cancels the timer + exits immediately.

## Hiccups along the way

**M1 jump-test physics**: the first version of the sim test
"jump clears a 2-tile gap" depended on engineering precise
parabolic-arc geometry against a 4-row level with a ceiling. The
ceiling clamped the jump short, the player landed in the pit, the
test failed. Rather than tune level geometry to match an exact
arc, I scoped the test down to "pressing space changes the
trajectory vs walk-only" — proves the input pathway, defers
geometric correctness to M2/M3 where the grid + A* test it
indirectly.

**M2 isGrounded semantics**: my first cut had `isGrounded`
delegate to `isSolid`, which treats off-grid as dirt (v4
autotile rule). That's right for renderer masking but wrong for
physics — the engine's `toWorld()` only emits Platform AABBs
from explicit `#` cells, so off-grid below = the player falls
through. Fixed by making `isGrounded` require an *in-bounds* `#`
below (and documented the distinction in a comment).

**M3 "unreachable" test wasn't unreachable**: my first
"unreachable" test had a player + exit on disconnected platforms
with a full floor at row 5 below. The agent could drop down,
walk across the floor, and jump back up — A* found a roundabout
path. Replaced with a level that's genuinely disconnected (tiny
platforms in a void).

**M4 typo**: `attempts is not defined`. I declared the loop var
`attempt` (singular) but referenced `attempts` (plural) in the
return. One-character fix; all 5 runner tests failed and recovered
together. Cautionary tale for "rely on tests, not eyes".

**M4 frame-0 jump-ignored**: the planner emitted the space press
at frame 0 of the recording, but the player's `onGround` flag
starts `false` and only becomes `true` after frame 0's physics
tick lands them on the spawn cell's supporting platform. So the
engine's `if (wantsJump && this.onGround)` gate silently dropped
the jump. Fix: planner's emit `frame` starts at 1, not 0. One
free frame of pre-settle. Walk-first plans pay a cosmetic +1
frame; no observable impact.

**M5 `exit = () => …` reassignment**: I needed to wrap the
launcher's `exit` function to also stop the rAF input ticker.
The original `exit` is a function declaration; reassigning a
function declaration's name binding is legal in ES modules
(strict by default), but I had a moment of doubt. Tests passed
first try, so the binding survived.

## The IDE-staging discipline holds

v19 M4 was the cautionary tale — the IDE pre-staged a fresh
`IncaTiles/` directory and my path-scoped `git add` saw the
already-in-index files at commit time. v20 ran `git status` before
every commit and caught one similar case (SynnyLand in M5),
deliberately keeping it out. Across all 6 commits, exactly the
intended files made it into the index; nothing else rode along.
Untracked tilesets `IncaTiles`, `SynnyLand`, `kenney_new-
platformer-pack-1.1`, the `SunnyLand Music` audio dir, and the
user's in-flight `fred.txt` / `above_ground2.txt` /
`manifest.json` mods / `wish_list.md` all stayed in the working
tree, none committed.

## What stayed out (v21+ candidates carried forward)

The natural follow-ups for the agent:

- **Multi-solution enumeration** — the locked v20 ships ONE
  shortest solution; the UI is already a list to make this a
  drop-in. v21's planner gains a "find K best routes" path
  (pickup-order permutations + routing variants).
- **TSP-optimal pickup ordering** — greedy is fine for v20.
- **Learning physics empirically** — v20 hard-codes from
  `constants.js`. A future agent could probe the engine for its
  own jump/walk reach.
- **Backtracking around walls** (collect-key-then-return) —
  v22+; needs a richer goal model.
- **Author-difficulty rating** — composite score from
  `{ steps, jumps, replans, deaths }`. Maybe a colour-coded
  "DIFFICULTY: ★★☆☆☆" in the dialog header.
- **Web Worker for big-world A*** — only if perceived
  performance demands it.
- **Multi-level cross-agent** — pairs with the v20+ doors /
  tunnels feature on the wishlist.
- **Per-tileset agent capabilities** — different player sprites
  could have different jump heights one day.

The carry-forwards from v18/v19:

- Damped/look-ahead camera, parallax backgrounds.
- Decoration-image free placement (Mockup.jpg promise from v18).
- Layered z-order with named layers.
- More Play Settings rows.

And the long-standing carry-overs (v16/v17):

- Per-cell animation phase offset.
- Pause-aware animation.
- Multi-row tile atlases (Treasure Hunters 17×5).
- State-changing exit (`imageActive`).
- Cleanup of v17's dead-end `caretLineCol` / `updateCursor`.

## The standing gap

Unchanged from v13–v19 — no automated DOM-mutation test of the
broader interactive surface beyond Playwright. v20 grew the unit
suite from 217 to 257 (+40 across the four agent modules) and
added one Playwright spec (4 cases) covering the [Test] button,
dialog states, overlay paint, and Demo replay. The six pre-v20
specs all stayed green throughout.

The agent's nav-graph is the strongest test surface — every
edge type (walk, drop, jump) has a dedicated unit case, and the
A* over that graph has cases for "trivial", "with pickup",
"with pickup ordering", "unreachable", "blocked-edge replan"
behaviour. Where the agent might still fail in practice — a
level with a parabolic jump arc that the straight-line clearance
check over-rejects — the runner's replan loop catches it via
headless validation, and the failure dialog surfaces the
diagnostic.

The standing limit: **v20 finds one solution and one solution
only**. If a level has multiple distinct routes (e.g. high-path
vs low-path), the agent picks the shortest and presents only
that. The user's wish — "each solution, if multiple solution
routes through the level are found" — is the explicit v21
acceptance criterion.
