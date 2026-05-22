# 2D Level Designer — Version 24 Design Document

Status: Proposed (scope confirmed 2026-05-22) · Builds on:
[version23_design.md](version23_design.md) (editor polish + agent
action-graph extensions) · Implementation:
[version24_implementation.md](../2_implementation/version24_implementation.md)

## 1. Purpose

Polish + paste-to-load + agent-investigation version. Five items in
scope (user-confirmed): a new editor affordance, two small polish
items, and the v22→v23 agent carry-overs.

### Thread A — Editor

1. **LOAD button.** New toolbar control beside `[New]`. Opens a
   modal with a `<textarea>`; user pastes the text of a level, the
   editor parses + validates it, stores it via the existing
   `levels.js` localStorage path under a new auto-generated ID,
   adds it to the `<select>`, and switches to it. Lets a user
   import a level from a `.txt` they didn't author through the
   download/upload workflow.

2. **`prefers-color-scheme` first-load default.** v23's 🌗 toggle
   defaults to dark. First-time visitor on a light-mode OS should
   land on light. Read the media query when there's no `v23.theme`
   localStorage entry yet; user choice via 🌗 still wins on every
   subsequent load.

3. **Multi-coloured path overlay.** When the agent finds ≥ 2
   solutions, render EACH on the overlay simultaneously in a
   distinct hue, with the focused one solid + others dimmed.
   Long-standing v22 carry-over.

### Thread B — Agent carry-overs

4. **`tutorial.txt` solves.** v23 diagnosed this as level-geometry,
   not action-graph. v24 ships the LEVEL REDESIGN — add intermediate
   row-2/3 platforms bridging the ooo platform to the exit. User-
   confirmed: no engine extension (no double-jump), v9 §7 invariant
   preserved.

5. **`below_ground.txt` solves.** Dies at frame 49 — re-investigate
   under the v23 action set; may share root cause with the
   spawn-fall settle.

6. **`precision_landing` rule.** The third item from v23's action-
   graph plan that didn't land: accept edges where the action's
   trajectory passes within ±2 px of a 1-tile target's centre.
   Needed for cherry-on-pillar (1-tile platform) variants the
   v22 tower-cherry sidestepped by being 3 wide.

### Out of scope (user-deferred from initial proposal)

- **Pickup-touch sound timing fix** — user removed from v24 scope;
  stays as a v25+ candidate in the wishlist.

## 2. Current state

### Editor (v23)
- `[New]` button opens the levels-dialog → creates a blank level.
- No paste-text-to-import flow.
- Levels: shipped (manifest-driven, read-only) + user drafts
  (localStorage `leveldesigner:v1:draft:<id>`).

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

### 3.1  LOAD button

`src/main.js` template gains:

```html
<button id="loadBtn" class="edit-only" title="Load — paste level text">Load</button>
```

Placed next to `[New]` so the affordance reads as "create or load".
Handler opens a new `openPasteLoadDialog({ onLoad })` modal
(parallel to `openPlaySettings`); the modal contains:

- A `<textarea>` for the pasted text (mono font; auto-focused).
- An optional `<input>` for the level's display name (defaults to
  the level's `# name:` directive if present, else `untitled`).
- `[Cancel]` + `[Load]` buttons.

On Load:
1. `parse(text)` — must yield a valid grid (rejects garbage).
2. `validate(parsed, legend)` — surfaces errors in the modal if
   any (does not close).
3. Generate a unique local ID: `local-${nanoid(6)}` (or similar).
4. `levels.saveDraft(id, text)` via the existing v8 storage API.
5. Add the new entry to `levelSel`.
6. `loadInto(id)` — same path as switching levels via the dropdown.
7. Close the modal.

The user can then edit + save + download as they would with any
other level. The "ID" is invisible to the user; the dropdown shows
the display name.

### 3.2  `prefers-color-scheme` first-load default

`src/main.js`:

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

If localStorage has the key, user choice wins. Otherwise OS pref
seeds the initial state. No reactive listener — once the user
has clicked 🌗 the value is locked.

### 3.3  Multi-coloured path overlay

`src/agent/overlay.js` gains:

```js
export function renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile) {
  // Non-focused first, dimmed.
  for (let i = 0; i < solutions.length; i++) {
    if (i === focusedIdx) continue;
    renderSolutionOverlay(ctx, solutions[i], tile, {
      colour: HUE_PALETTE[i % HUE_PALETTE.length],
      alpha: 0.35,
    });
  }
  // Focused on top, solid.
  renderSolutionOverlay(ctx, solutions[focusedIdx], tile, {
    colour: HUE_PALETTE[focusedIdx % HUE_PALETTE.length],
    alpha: 1.0,
  });
}
```

`HUE_PALETTE` = 5 high-contrast HSL values (matches MAX_SOLUTIONS).
The existing `renderSolutionOverlay` gains an optional
`{colour, alpha}` parameter; defaults preserve v22 behaviour.

`src/main.js`'s `onResult` callback dispatches to the multi-renderer
when `result.solutions.length > 1`, else the single renderer.

### 3.4  `tutorial.txt` — level redesign

Replace `public/data/levels/tutorial.txt` with a self-consistent
version. Add an intermediate platform at row 2/3 to bridge the gap.
Proposed shape:

```
# name: tutorial
# order: 1
# size: 24x10
########################
#......................#
#...P.......##....E....#   ← NEW row-2 platform at cols 12–13
#...........##...######    ← supports it (row-3 wall)
#.......oooo...........#
#......######..........#
#......................#
#..........^^^.........#
#......................#
########################
```

Tested before commit by running the agent — must report
`✓ Level completable` with ≥ 4 pickups collected.

### 3.5  `below_ground.txt` re-investigation

Diagnostic Playwright probe (same style as v23's scratch tests).
Two hypotheses to test:

- The spawn-fall settle (v22 M1) sends the player THROUGH a
  hazard cell during the gravity-only ticks. Fix: hazard collision
  checks in the no-input settle loop.
- The starting cell (after settle) is adjacent to a hazard that
  the first walk/jump action steps into. Fix: planner heuristic
  to avoid hazard-adjacent edges.

Implementation depends on which hypothesis lands.

### 3.6  `precision_landing` rule

`src/agent/grid.js`'s `addActionEdges` extended:

```js
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
          ...edgeFields,
        });
        break;
      }
    }
  }
}
```

Requires `simulateActionInContext` to also return the per-frame
trajectory. `precisionTargets` = `pickupCells ∪ exitCells`,
computed once per buildNavGraph call.

## 4. UX in detail

### 4.1  LOAD modal

```
┌────────────────────────────────────────┐
│ Load Level                             │
│ ────────────────────────────────────── │
│                                        │
│ Paste a level definition below:        │
│ ┌────────────────────────────────────┐ │
│ │ # name: my-level                   │ │
│ │ ##########                         │ │
│ │ #P......E#                         │ │
│ │ ##########                         │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Display name: [ my-level         ]     │
│                                        │
│ [Cancel]         [Load]                │
└────────────────────────────────────────┘
```

After Load: the new level is in the dropdown, selected, and editable.

### 4.2  Theme on first load

First-time visitor on a light-mode OS sees the light theme
immediately. No flicker. No user action required.

### 4.3  Multi-coloured overlay

```
       focused (S1) — solid yellow  ━━━●━━━●━━━
                  S2 — dimmed cyan    ╴╴╴○╴╴╴○╴╴╴
                  S3 — dimmed magenta ┄┄┄◇┄┄┄◇┄┄┄
```

Click a non-focused row in the dialog → that solution becomes solid,
others fade to dim. Helps the user compare routes visually.

### 4.4  Tutorial fix

The shipped `tutorial.txt` now has visible row-2/3 platforms
bridging the gap. The agent solves it (≥ 4 pickups). Players who
copied the level to a local file see the OLD shape until they
re-load the shipped version.

### 4.5  below_ground.txt fix

After the diagnostic + repair, the agent solves the level.

### 4.6  Precision landing

User-invisible — the agent just reaches 1-tile pickups it couldn't
before. Future levels can use narrower platforms.

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/main.js` | `[Load]` button + handler; `prefers-color-scheme` seeds first-load theme; multi-solution onResult dispatches to renderAllSolutionsOverlay. |
| `src/loaderDialog.js` (or new `src/pasteLoadDialog.js`) | `openPasteLoadDialog({onLoad})` modal. |
| `src/agent/overlay.js` | `renderAllSolutionsOverlay`; existing `renderSolutionOverlay` gains optional `{colour, alpha}` params. |
| `public/data/levels/tutorial.txt` | Replace with self-consistent shape (intermediate row-2/3 platforms). |
| `src/play/playtestScene.js` or `src/agent/planner.js` | `below_ground.txt` fix per M5 investigation. |
| `src/agent/simAction.js` | Return per-frame `trajectory: [{x, y}, ...]`. |
| `src/agent/grid.js` | `addActionEdges` extended with precision_landing rule. |
| `src/style.css` | `.paste-load-dialog` modal styling (matches v23 popup look + lightmode overrides). |
| `tests/v24-load-button.spec.js` (new) | Open Load modal, paste a level, assert it's now in the dropdown + selected. |
| `tests/v24-theme-os-default.spec.js` (new) | Mock matchMedia; assert theme matches OS pref on first load + localStorage wins after. |
| `tests/v24-multi-overlay.spec.js` (new) | Sample overlay pixels with ≥ 2 solutions; assert focused-row alpha > non-focused. |
| `tests/v24-tutorial-solves.spec.js` (new) | The acceptance gate from v23 carried forward; tutorial.txt now solves. |
| `tests/v24-below-ground.spec.js` (new) | Acceptance: below_ground.txt solves. |
| `tests/v24-precision-landing.spec.js` (new) | 1-tile pickup midway between two grounded cells is reachable. |
| `TDDs/3_transcripts/version24_build.md` (new, M-final) | narrative |

## 6. Open questions — proposed defaults

- **LOAD button placement**: proposed beside `[New]`. Alternative:
  inside the levels-dialog (next to "Create new"). Beside [New] is
  more discoverable.
- **LOAD modal validation**: proposed reject on parse-error OR
  validation-error; surface message in the modal. User can fix
  the text and re-Load.
- **LOAD level naming**: proposed default to `# name:` directive
  if present, else `untitled`. User can edit before clicking Load.
- **OS-pref listener**: proposed **first-load only** (no reactive
  listener). Once the user has clicked 🌗, lock to their choice.
- **Multi-colour palette**: proposed 5 HSL values
  `{yellow, cyan, magenta, lime, orange}` — high-contrast on both
  themes. Tunable post-ship.
- **tutorial.txt fix mechanism**: **CONFIRMED level redesign**
  (user choice). v9 §7 invariant preserved.
- **`below_ground.txt` scope**: proposed **investigate + ship the
  diagnosed fix in M5**. If unfixable in v24, document for v25.
- **Precision-landing tolerance**: ±2 px (matches v23 plan). Tight
  enough for 1-tile targets.

## 7. Acceptance criteria

### Editor
- **LOAD modal** opens via `[Load]`; pasting valid text creates a
  new local level, adds it to the dropdown, switches to it.
- **Invalid text** (parse error / no grid) surfaces an error in
  the modal — modal stays open, user can fix.
- **Theme** matches OS pref on first load (no localStorage entry);
  user choice wins on every subsequent load.
- **Multi-coloured overlay** paints all solutions when ≥ 2;
  focused-row click swaps which is solid; non-focused alpha < focused.

### Agent
- **`tutorial.txt` solves** — `.badge.ok` within 5 s; ≥ 4 pickups
  collected.
- **`below_ground.txt` solves** — `.badge.ok` within 5 s.
- **`precision_landing`** — agent reaches a 1-tile pickup wedged
  between two walls in a unit-test level.

### Tests
- `npm test` green; `npx playwright test` green (existing 53 + ≥ 6
  new cases).

## 8. Non-impact (explicit)

- **Tileset schema** — unchanged (v22.1's `imageLocked` ships
  as-is).
- **Vendored `src/play/core/*` + `src/play/entities/*`** —
  byte-identical. v9 §7 invariant preserved (user-confirmed: no
  double-jump engine extension in v24).
- **v18+ play-mode toolbar / problems bar / legend layout** —
  unchanged.
- **v22 multi-solution enumeration + v23 minimise** — unchanged;
  multi-colour overlay augments the rendering, doesn't change
  the data flow.
- **Path-scoped `git add`** discipline — unchanged.

## 9. v25+ candidates / deferred

- **Pickup-touch sound timing fix** — user-deferred from v24
  initial scope; stays in the wishlist.
- **Double-jump engine extension** — alternative tutorial.txt fix
  the user passed over for v24; could return in v25+ for the
  broader level-capability uplift it offers.
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

- **LOAD ID collision** — if two pasted levels happen to generate
  the same `local-XXXXXX` ID. Mitigation: nanoid's 6-char IDs give
  ~10⁹ combinations; collision check on save (regenerate if
  collision).
- **LOAD invalid text** — partial parses (e.g. missing grid)
  could leave the editor in a half-loaded state. Mitigation:
  parse + validate BEFORE saving; on error, surface in the modal
  and leave the current level untouched.
- **OS-pref listener leak** — v24 ships first-load-only (no
  listener), so no leak surface.
- **Multi-colour palette readability** — too many similar hues =
  noisy overlay. Cap at MAX_SOLUTIONS = 5.
- **Tutorial level edit affects authored content** — users who
  copied `tutorial.txt` to a local file see the OLD shape until
  they re-load. Mitigation: edit only the shipped file; users with
  their own copies are unaffected.
- **below_ground.txt fix touches the planner** — risk of regressing
  v21/v22/v23 solvable levels. Mitigation: full agent-suite
  Playwright pass before shipping.
- **Precision-landing trajectory data inflates simAction memory** —
  Mitigation: only collect trajectory when `precisionTargets` is
  non-empty; sample one frame in every 2 if budget-tight.

## 11. Why this scope

v23 closed the editor-polish thread and started — but didn't
finish — the agent-action-graph thread. v24 finishes it (tutorial,
below_ground, precision_landing), lands one new editor affordance
(LOAD), and ships two small polish items (OS theme default,
multi-colour overlay).

The user explicitly chose the level-redesign route for
tutorial.txt over the double-jump engine extension, preserving the
v9 §7 byte-identical-to-upstream invariant. Discipline carry-over
from v22/v23: small + scoped + gated. No grand new feature.
