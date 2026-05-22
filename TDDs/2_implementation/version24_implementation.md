# Version 24 — Implementation Plan

Status: Proposed · Date: 2026-05-22 · Design:
[../1_design/version24_design.md](../1_design/version24_design.md)

Six small path-scoped commits. The two threads — editor (M1-M3) and
agent (M4-M6) — interleave so each polish item lands before the
larger agent investigations.

## Process (same discipline as v8–v23)

- **One milestone per commit.** Before each: `npm test` green,
  `npx playwright test` green, `npm run build` clean,
  `npm run build:pages` clean.
- **`git status` BEFORE every commit; path-scoped `git add` only.**
  The user's in-flight `fred.txt` / `above_ground2.txt` /
  `manifest.json` / `__temp/` / tileset `src.txt` / `sources.txt`
  files stay out.
- **v9 §7 byte-identical-to-upstream invariant for `src/play/core/*`
  and `src/play/entities/*`** preserved. v24 only touches v9-original
  glue (`playtestScene.js`), editor modules, and `src/agent/*`.

## Constraints & approach

- **Back-compat is the gate at every milestone**:
  - LOAD writes through the existing `levels.js` API; no new
    storage schema. Existing levels (manifest + drafts) untouched.
  - `prefers-color-scheme` only seeds the FIRST-load default;
    localStorage continues to win after first interaction.
  - `renderSolutionOverlay` gains an optional `{colour, alpha}`
    parameter — defaults preserve v22 behaviour for the single-
    solution path.
  - Tutorial.txt edit is the SHIPPED file only; user drafts that
    happen to be copies are unaffected.
- **Riskiest change is M5 (below_ground.txt fix)** — likely touches
  the planner / spawn-settle. Mitigation: run the full Playwright
  agent suite before shipping; v21/v22/v23 solvable levels must
  still solve.
- **Precision-landing scope-cap**: only collect trajectory data when
  `precisionTargets` is non-empty; sample one frame in every 2 if
  the per-graph build runs hot.

## Module map

| File | Change | Lands in |
|------|--------|---|
| `src/main.js` | `<button id="loadBtn">` template + click handler that opens openPasteLoadDialog + dispatches to `levels.saveDraft` + `loadInto` | M1 |
| `src/loaderDialog.js` | New `openPasteLoadDialog({ onLoad })` modal — textarea + name input + validate-before-save | M1 |
| `src/style.css` | `.paste-load-dialog` styling + lightmode overrides | M1 |
| `tests/v24-load-button.spec.js` (new) | Paste valid level → in dropdown + selected; paste invalid → error surfaced in modal, no level added | M1 |
| `src/main.js` | `defaultTheme()` reads `matchMedia('(prefers-color-scheme: light)')` when localStorage empty | M2 |
| `tests/v24-theme-os-default.spec.js` (new) | Mock `matchMedia` via `page.emulateMedia({colorScheme: 'light'})`; assert body has `lightmode` on first load; reload with no pref change preserves; user-clicked theme survives matchMedia override | M2 |
| `src/agent/overlay.js` | `renderSolutionOverlay(ctx, solution, tile, opts)` adds `opts = {colour, alpha}`; new `renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile)` | M3 |
| `src/main.js` | Test handler's onResult dispatches to renderAllSolutionsOverlay when `result.solutions.length > 1` | M3 |
| `tests/v24-multi-overlay.spec.js` (new) | Drive a 2-pickup level that yields ≥ 2 solutions; sample overlay pixels on each path; assert distinct hues + focused-path alpha > non-focused | M3 |
| `public/data/levels/tutorial.txt` | Replace with self-consistent shape (row-2/3 intermediate platform) | M4 |
| `tests/v24-tutorial-solves.spec.js` (new) | Load tutorial; click Test; `.badge.ok` within 5 s; ≥ 4 pickups in focused solution | M4 |
| `src/agent/simAction.js` | Return per-frame `trajectory: [{x, y}]` when caller requests it | M5 |
| `src/agent/grid.js` | `addActionEdges` extended: for each action, check if trajectory passes ±2 px of any precisionTarget; emit additional edge if so | M5 |
| `tests/v24-precision-landing.spec.js` (new) | Unit test for grid.js with a contrived 1-tile pickup midway in a fall arc | M5 |
| `src/agent/planner.js` or `playtestScene.js` | `below_ground.txt` fix per investigation outcome | M5 |
| `tests/v24-below-ground.spec.js` (new) | Load below_ground; click Test; expect `.badge.ok` within 5 s | M5 |
| `TDDs/3_transcripts/version24_build.md` (new) | narrative covering each milestone | M6 |

## Milestone 1 — LOAD button

1. `src/main.js` template: `<button id="loadBtn" class="edit-only"
   title="Load — paste level text">Load</button>` between `[New]`
   and the `Level:` picker.
2. `src/loaderDialog.js` (or new `src/pasteLoadDialog.js`):
   - Export `openPasteLoadDialog({ onLoad, onCancel })`.
   - Template: header + `<textarea id="pl-text" rows="14">` + a
     name input `#pl-name` + Cancel/Load buttons.
   - On Load click: `parse(text)` → `validate(parsed, legend)`.
   - On error: render error list inside the modal; keep modal open.
   - On success: call `onLoad({ text, name })`; modal closes.
3. `src/main.js` handler:
   - On `#loadBtn` click → `openPasteLoadDialog({ onLoad: (...) => {
       const id = `local-${randomId(6)}`;
       saveDraft(id, text);
       repopulateLevelSelect();
       loadInto(id);
     }})`.
4. `src/style.css`:
   - `.paste-load-dialog .pl-text { font-family: var(--mono); width:
     100%; min-height: 250px; ... }`
   - lightmode overrides as needed.
5. `tests/v24-load-button.spec.js`:
   - Click `#loadBtn` → modal appears.
   - Paste `##########\n#P......E#\n##########`.
   - Click Load → modal closes; `#levelSel` has a new option;
     `#levelSel.value` equals it.
   - Re-open Load; paste invalid text `notAGrid` → error surfaced;
     modal stays open.
6. **Visible after this commit**: a `[Load]` button next to
   `[New]`; pasting a level text creates + selects a local entry.

Commit: `v24 m1: LOAD button — paste level text into a new local entry`.

## Milestone 2 — prefers-color-scheme first-load default

1. `src/main.js`:
   - `function defaultTheme() {
       try {
         if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
       } catch {}
       return 'dark';
     }`
   - `let theme = readEnumPref('v23.theme', defaultTheme(), ['dark', 'light']);`
   - `applyTheme()` already runs at module init.
2. `tests/v24-theme-os-default.spec.js`:
   - Use `page.emulateMedia({ colorScheme: 'light' })` before
     `goto`; assert `body.classList` contains `lightmode` on first
     load (no localStorage entry).
   - Toggle to dark; reload (still emulating light); assert dark
     wins (user choice locked).
   - `page.emulateMedia({ colorScheme: 'dark' })` then fresh
     localStorage; assert dark.
3. **Visible after this commit**: light-mode-OS users land on
   light theme on first visit; once they click 🌗, their choice
   is locked.

Commit: `v24 m2: prefers-color-scheme first-load theme default`.

## Milestone 3 — Multi-coloured path overlay

1. `src/agent/overlay.js`:
   - `renderSolutionOverlay(ctx, solution, tile, opts = {})` —
     accepts `opts.colour` (CSS hue) + `opts.alpha`. Default
     preserves v22 (the existing palette).
   - `renderAllSolutionsOverlay(ctx, solutions, focusedIdx, tile)`:
     ```js
     export const HUE_PALETTE = ['#ffe066', '#66d9e8', '#f06292', '#aed581', '#ffb84d'];
     // dim non-focused first
     for (let i = 0; i < solutions.length; i++) {
       if (i === focusedIdx) continue;
       renderSolutionOverlay(ctx, solutions[i], tile, {
         colour: HUE_PALETTE[i % HUE_PALETTE.length],
         alpha: 0.35,
       });
     }
     // focused on top
     renderSolutionOverlay(ctx, solutions[focusedIdx], tile, {
       colour: HUE_PALETTE[focusedIdx % HUE_PALETTE.length],
       alpha: 1.0,
     });
     ```
2. `src/main.js` test handler `onResult`:
   - If `result.solutions.length > 1`: call
     `renderAllSolutionsOverlay(octx, result.solutions, result.focusedIdx ?? 0, TILE);`
   - Else: existing single-renderer call.
3. `tests/v24-multi-overlay.spec.js`:
   - Drive a 2-pickup level that yields ≥ 2 solutions.
   - Sample a pixel on the focused-row path; assert hue ≈ yellow.
   - Sample a pixel on a non-focused path; assert hue differs.
   - Click a non-focused row; sample again; assert hues swapped.
4. **Visible after this commit**: when the agent finds ≥ 2
   solutions, all paths render simultaneously; focused is solid.

Commit: `v24 m3: multi-coloured path overlay for multi-solution display`.

## Milestone 4 — tutorial.txt level redesign

1. Edit `public/data/levels/tutorial.txt`:
   - Add a 2-cell platform at row 2 cols 12–13 supported by row 3
     walls at the same cols.
   - Re-run agent: must report `✓ Level completable` with ≥ 4
     pickups in the focused solution.
2. `tests/v24-tutorial-solves.spec.js`:
   - Load tutorial via fetch.
   - Click Test; wait for `.badge.ok` within 5 s.
   - Read focused-row stat pills; assert `4 pickups`.
3. **Visible after this commit**: tutorial.txt is now physically
   solvable; the agent finds the route; the player can follow it.

Commit: `v24 m4: tutorial.txt — add intermediate platform so level is solvable`.

## Milestone 5 — below_ground.txt + precision_landing

This milestone bundles BOTH agent items since they share the
trajectory infrastructure.

1. `src/agent/simAction.js`:
   - Optional `opts.collectTrajectory` flag; when set,
     `runSimLoop` pushes `{x, y}` per frame to a `trajectory`
     array; returned alongside the existing fields.
   - When unset (the back-compat path), no trajectory work — zero
     impact on v22/v23 callers.
2. `src/agent/grid.js`:
   - Compute `precisionTargets = new Set([...pickupCells, ...exitCells])`.
   - Pass `{ collectTrajectory: true }` to `simulateActionInContext`
     when precisionTargets is non-empty.
   - For each candidate action's trajectory: check ±2 px of every
     target's cell centre; emit an additional edge if a pass-near
     is found (in addition to the cell-resolved edge).
3. `tests/v24-precision-landing.spec.js`:
   - Construct a level with a 1-tile pickup midway between two
     grounded cells, reachable only via a fall arc that passes
     within ±2 px of the pickup centre.
   - Build the nav graph; assert the pickup cell has at least one
     incoming edge.
4. **`below_ground.txt` investigation**:
   - Add diagnostic Playwright probe (temporary; deleted post-fix).
   - Identify root cause: hazard touch during spawn-fall settle,
     or hazard-adjacent first-step.
   - Fix:
     - **If spawn-fall settle** — extend the v22 `#spawnFallSettle()`
       to bail if any frame's collision flips `phase === 'dead'`,
       restore original input, and let the live engine handle the
       death naturally (no agent shenanigans).
     - **If hazard-adjacent** — add a hazard-cost heuristic in the
       planner's A* (cells within 1 of a hazard cost +N).
5. `tests/v24-below-ground.spec.js`:
   - Load below_ground; click Test; `.badge.ok` within 5 s.
6. **Visible after this commit**: tutorial AND below_ground both
   solve; new edge type is exercised in the unit test.

Commit: `v24 m5: precision_landing edge rule + below_ground.txt fix`.

## Milestone 6 — Acceptance e2e + transcript + Delivered

1. `tests/v24-acceptance.spec.js`:
   - Cross-cutting case (e.g. "themed editor still solves tutorial").
2. `TDDs/3_transcripts/version24_build.md`: narrative covering
   the LOAD button (new affordance, no schema change), the OS
   theme default (a single matchMedia line, big UX upgrade), the
   multi-colour overlay (focused vs dimmed render), the
   tutorial fix (level redesign — no engine breakage), and the
   below_ground / precision_landing outcomes.
3. Mark design + impl Delivered with the M1–M6 commit-hash table
   (matching v22/v23 pattern).

Commit: `v24 m6: acceptance + v24 transcript; design + impl Delivered`.

## Risks & sequencing

- **M1 LOAD ID collision** — 6-char nanoid → ~2^36 IDs. Collision
  unlikely but possible; check before saving.
- **M2 matchMedia unavailable** — older browsers or test environments.
  Mitigation: try/catch around the call; fall back to dark.
- **M3 multi-colour overlay obscures focused path** — non-focused
  paths might draw OVER the focused on close cell-overlaps.
  Mitigation: focused-on-top draw order; alpha < 1 for non-focused.
- **M4 tutorial.txt shape change** — users with local copies see
  the OLD level. Mitigation: only the SHIPPED file is changed.
- **M5 precision_landing trajectory memory** — described in
  design §10.5. Mitigation: optional `collectTrajectory` flag;
  no impact on v22/v23 callers.
- **M5 below_ground fix touches the planner** — risk of regressing
  v21/v22/v23 solvable levels. Mitigation: full agent-suite
  Playwright pass before shipping.
- **No deploy risk** — bundle grows by ~3-5 KB (LOAD modal +
  multi-colour palette + grid.js trajectory checks).

## Deferred (design §9 → v25+)

- **Pickup-touch sound timing fix** (user-deferred from v24 scope).
- **Double-jump engine extension** (the alternative tutorial fix).
- **Reactive theme listener**.
- **Viewport guide follows mouse**.
- **Author-resizable legend width** + **drag-and-drop legend
  reorder** + **per-tileset legend persistence**.
- **Minimap with fog-of-war**.
- **Edit-mode level resize**.
- **Linked levels via doors / tunnels**.
- **Sloping tiles**.
- **Multi-exit / 1-way platform** runtime options.
- **Lemmings-AI adversarial mode**.
- **Path-hint tutorial mode**.
- **AI-rated difficulty / fun / challenge**.
- **AI level designer**.

Plus the long-standing v16/v17/v18/v19 carry-overs.
