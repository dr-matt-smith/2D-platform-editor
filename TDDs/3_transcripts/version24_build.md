# Transcript — Version 24: LOAD, OS-Theme, Multi-Colour Overlay, Tutorial Solves, Below-Ground Diagnosed

A narrative record of the v24 phase. Three small polish items, one new
editor affordance, one shipped level redesign, and one
agent-investigation milestone that surfaced an architectural
carry-over to v25.

The brief, distilled from the v23 wishlist tidy + the user's
AskUserQuestion scope answers:

1. **LOAD button** — paste level text → new local entry (new user
   request, added to the wishlist after v23 shipped).
2. **`prefers-color-scheme` first-load default** — a first-time
   visitor on a light-mode OS lands on light without clicking 🌗.
3. **Multi-coloured path overlay** — when the agent finds ≥ 2
   solutions, paint each in a distinct hue (long-standing v22
   carry-over).
4. **`tutorial.txt` solves** — user chose the level-redesign route
   (3.4.a in the design) over the double-jump engine extension,
   preserving the v9 §7 byte-identical-to-upstream invariant.
5. **`below_ground.txt` + `precision_landing`** — the remaining
   v22/v23 agent carry-overs.

User-deferred from initial scope: pickup-touch sound timing fix
(remains in the wishlist as a v25+ candidate).

The user's go-ahead, verbatim:

> implement milestones please

## The shape of the work

Six small commits, one milestone each:

| M | Commit    | Deliverable                                                                                                  |
|---|-----------|--------------------------------------------------------------------------------------------------------------|
| 1 | `48295f9` | `src/levels.js` gains `addLocal / removeLocal / isLocalId`; `list()` merges manifest + locals. `src/loaderDialog.js` adds `openPasteLoadDialog`. `src/main.js` wires the `#loadBtn` through `guardUnsaved` → parse + validate → `levels.addLocal` → `loadInto`. CSS for the modal + lightmode overrides. |
| 2 | `75679d6` | `defaultTheme()` reads `matchMedia('(prefers-color-scheme: light)')` when no `v23.theme` localStorage entry exists. User choice via 🌗 still wins on every subsequent load. v23 theme suite gains a `beforeEach` emulating dark-OS so its "initial state is dark" precondition holds. |
| 3 | `b3fe638` | `src/agent/overlay.js` adds `HUE_PALETTE` (5 hues, first entry = v22 yellow), an optional `{colour, alpha}` param on `renderSolutionOverlay`, and new `renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile)` that paints non-focused dimmed (alpha 0.35) + focused solid (alpha 1.0). `main.js` dispatches to the multi-renderer when `solutions.length > 1`. |
| 4 | `598fe47` | `public/data/levels/tutorial.txt` row 3 extended leftward from cols 18–23 to cols 14–23. The new platform's top (row 2 cells 14–22) is now walkable + grounded; a jump from the ooo platform's rightmost grounded cell (4, 12) lands at row 2 col 15–16, and the player walks right to the exit at col 18. Agent verified: solves within ~1s, 4 pickups. |
| 5 | `38062f7` | Investigation + carry-over. `below_ground.txt`'s frame-49 death diagnosed as a planner/sim divergence; the planner's `emitLegInputs` drops the jump's `holdFrames` parameter, the whole-plan recording keeps `right` held the whole arc, the player overshoots into the row-15 hazard pit. A planner patch DOES fix below_ground but REGRESSES above_ground — the deeper root cause is the cell-resolved edge model vs the continuous-x simulation. v25 architectural change required. |
| 6 | _this commit_ | v24 acceptance + transcript; design + impl Delivered |

Outcome: 295 unit tests pass (no new unit cases — work was integration-
heavy). Playwright 53 → 67 (+14: M1 ×5, M2 ×3, M3 ×3, M4 ×1, M5 ×2).
v9 §7 byte-identical-to-upstream invariant for `src/play/core/*` +
`src/play/entities/*` preserved across all six commits. Bundle:
71.16 → 74.90 kB JS (gzip 24.74 → 26.07 kB). Path-scoped `git add`
discipline held — no `__temp/`, no `manifest.json`, no
`above_ground2.txt` / `fred.txt`, no tileset `src.txt` / `sources.txt`
touched the index.

## Thread A — Editor affordances + polish

### M1 — LOAD button

The user's wishlist addition arrived between the v24 design draft and
its scope-confirmation phase. Scope: a new toolbar button that opens
a modal with a `<textarea>` for pasted level text + a display-name
input. On Load: parse + validate, then route through the existing
`levels.saveDraft` storage path. The result is a new entry in the
level dropdown that the user can edit, save, and download like any
shipped level.

The cleanest implementation extended `levels.js` with a parallel
**local levels list** (separate from the build-time manifest):

```js
function addLocal(text, name = 'untitled') {
  const id = `local-${randomId(8)}`;
  storage.setItem(KEY.draft(id), text);
  const locals = readLocals();
  locals.push({ id, name });
  writeLocals(locals);
  return id;
}
```

The new ID uses the `local-` prefix so `load(id)` can short-circuit:
local entries are draft-only (no original file to fetch). `list()`
returns manifest + locals merged, and the existing
`populateLevelMenu()` iterates that as if they were all bundled.

The dialog itself (`openPasteLoadDialog`) parallels the v18
`openPlaySettings` shape — title bar + textarea + name input +
inline error panel. Parse errors surface as a coloured callout
without closing the modal, letting the user fix the text and
re-Load.

5 Playwright cases cover the flow: modal opens/closes, valid text
creates entry + switches, invalid surfaces error, name-directive
auto-fill, persistence across reload.

### M2 — `prefers-color-scheme` first-load default

A single function:

```js
function defaultTheme() {
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch { /* matchMedia unavailable */ }
  return 'dark';
}
```

`readEnumPref('v23.theme', defaultTheme(), ['dark', 'light'])`. If
the user has clicked 🌗 once, localStorage wins. Otherwise the OS
preference seeds the initial state. No reactive listener (a v25
candidate) — once user has chosen, the choice is locked.

The v23 theme suite needed a `test.beforeEach(page.emulateMedia({
colorScheme: 'dark' }))` so its "initial state is dark"
precondition still holds — those tests were written when the
default was hardcoded `'dark'`.

### M3 — Multi-coloured path overlay

Five hues, tuned for both themes:

```js
export const HUE_PALETTE = [
  '#ffcc00',  // yellow (Solution 1 — matches v22 default)
  '#66d9e8',  // cyan
  '#f06292',  // magenta
  '#aed581',  // lime
  '#ffb84d',  // orange
];
```

The existing `renderSolutionOverlay(ctx, solution, tile, opts)`
gains an optional `{colour, alpha}` parameter. When opts is
absent, behaviour is byte-identical to v22 (single-solution
yellow). The new `renderAllSolutionsOverlay` calls it once per
solution: non-focused first with `alpha: 0.35`, focused on top
with `alpha: 1.0`.

`main.js`'s `onResult` callback dispatches to the multi-renderer
only when `solutions.length > 1`, so the single-solution path is
unchanged.

## Thread B — Agent carry-overs

### M4 — tutorial.txt level redesign

User-confirmed at the design phase: the level-redesign route
(preserves v9 §7 invariant) over the double-jump engine extension
(would break it).

v23's frame-by-frame trajectory probe identified the row-2 exit
sitting 6 rows above the bottom floor as physically unreachable
from the single intermediate row-4 ooo platform — jumps from row
4 clipped the row-0 ceiling and the post-bump trajectory dropped
the player below row 2 long before reaching col 18.

The fix is a single-line level edit. Row 3 extended leftward:

```
Original: #.................######    (1 + 17 dots + 6 #)
Modified: #.............##########    (1 + 13 dots + 10 #)
```

Now cells (2, 14-22) are all walkable + grounded by the new row-3
platform. A jump-right from the ooo platform's rightmost grounded
cell (4, 12) lands at row 2 col 15-16; the player walks right to
(2, 18) = E.

The agent solves within ~1 s, all 4 ooo pickups collected on the
way.

A first attempt at the level file via the Write tool added a
trailing newline that the parser counted as an 11th row,
mismatching the `# size: 24x10` directive — discovered when the
toolbar-pin Playwright tests timed out because Play mode refused
to launch on the broken level. Rewritten with `printf` to control
the trailing-newline byte exactly.

### M5 — below_ground.txt + precision_landing carry-over

This milestone investigated below_ground's frame-49 death and
attempted a fix. The investigation surfaced a deeper
architectural issue and the fix was REVERTED to avoid regressing
above_ground.

The diagnostic chain (recorded in the M5 commit):

1. **Symptom**: below_ground's last simulation dies at frame 49
   at world (256, 287) = col 12.8, row 14.35 — the row-15
   hazard pit.
2. **Plan trace**: 26 steps from (10, 3) to (5, 39) exit, via
   row-7 then row-5 platforms. The first action is a jump
   (10, 3) → (8, 9) with build-time `holdFrames: 28`,
   `cost: 37`.
3. **Build-time edge sim** (simAction): launches at vx=240,
   releases dir at frame 28, lands at (8, 9) on frame 37.
   Edge is correct-by-construction.
4. **Whole-plan sim** (sim.js): keeps `right` held until frame
   103 (when the planner's *direction-change* logic finally
   releases it). The first jump's trajectory differs from the
   build-time prediction — vx stays 240 the whole arc. Player
   overshoots into the row-15 hazards at col 12.8.
5. **Root cause**: the planner's `emitLegInputs` drops the
   action's `holdFrames` parameter. The recording chain emits
   space-tap for jumps but never emits the mid-arc dir-release.
6. **Patch attempt**: explicitly emit a dir-release at
   `startFrame + edge.action.params.holdFrames` when
   `holdFrames < edge.cost`.
   - Result on below_ground: dies at frame 49 → reaches (7, 22)
     with score 8 (all row-7 ooo's collected). PROGRESS.
   - Result on above_ground: previously-solving level now TIMES
     OUT. The OLD held-throughout trajectory landed on a
     COINCIDENTALLY-VALID platform that the corrected trajectory
     misses.
7. **The deeper issue**: the agent's edges declare endpoints by
   CELL; the actual physics moves the player by SUB-CELL pixels.
   Multi-step plans accumulate sub-pixel drift that breaks edge
   predictions. The cell-resolved edge model is the wrong
   abstraction for tight-tolerance multi-jump levels.
8. **Decision**: revert the patch. Ship M5 as a documented
   investigation. v25 needs an architectural change — either
   sub-pixel edge endpoints or a per-frame-trajectory planner.

`precision_landing` was the second M5 item. It would add a new
edge type (accept actions whose trajectory passes within ±2 px
of a target cell) on top of the existing edge model. Building
on the unstable foundation was deemed premature; deferred to
v25 alongside the architectural fix.

The M5 test asserts the diagnostic outcome (below_ground fails
with the expected diagnostic) AND that above_ground +
tower-cherry still solve. Either-or gate on below_ground so
v25 can ship the fix without rewriting the spec.

## Discipline carry-overs that held

- **Path-scoped `git add`** — the `[[scoped-git-add]]` memory
  rule held all six commits. `__temp/`, `manifest.json`,
  `above_ground2.txt`, `fred.txt`, `IncaTiles/src.txt`,
  `PlayWithYourPeas/sources.txt` all stayed unstaged. An IDE
  auto-stage of `__temp/test_levels/pretty_difficult.txt` mid-
  session was caught by the pre-commit `git status` and
  unstaged before the next commit landed.

- **v9 §7 byte-identical vendored engine** — `src/play/core/*`
  and `src/play/entities/*` untouched. The M4 tutorial fix was
  a level-content edit (no engine change). M5 was a comment-
  only change to `src/agent/planner.js`. The double-jump
  alternative (the engine-touching route) stays in the
  wishlist as a future candidate.

- **One milestone per commit** — six commits, six logical
  units. Each shipped only after `npm test` + `npx playwright
  test` + `npm run build` were green. M4 caught the trailing-
  newline regression in the same commit, not papered over.

## What this leaves for v25+

- **Cell-resolved edge model architectural fix** — needed for
  below_ground (and any level with tight-tolerance multi-jumps).
  Two candidate approaches: (a) edges carry sub-pixel endpoints,
  (b) planner uses per-frame trajectories instead of cells.
- **`precision_landing` edge rule** — deferred until the
  architectural fix lands.
- **Pickup-touch sound timing fix** — user-deferred from v24
  scope.
- **Double-jump engine extension** — the alternative tutorial
  fix; preserves the architectural option for richer
  gameplay.
- **Reactive theme listener** — respond to OS-pref flips
  mid-session.
- **Viewport guide follows mouse** — v23 carry-over.
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

Plus the long-standing v16/v17/v18/v19 carry-overs.

## Closing

v24 lands two visible editor affordances (LOAD button + OS-theme
default), one visible agent affordance (multi-colour overlay),
one shipped level fix (tutorial.txt), and one carefully-
documented architectural diagnosis (below_ground). The
discipline carry-overs from v22/v23 held: small commits, scoped
adds, byte-identical engine, gated test passes. Bundle 74.90 kB
JS (gzip 26.07 kB).

The agent's cell-resolved edge model has revealed its limits.
v25's first task is to choose between the two architectural
options and ship below_ground's full solve under the new model.
