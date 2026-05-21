# Version 17 — Implementation Plan

Status: Proposed · Date: 2026-05-21 · Design:
[../1_design/version17_design.md](../1_design/version17_design.md)

Three small path-scoped commits. The four UX changes in design §4
split cleanly into a layout milestone (left pane + splitters hidden,
problems bar collapsed to one line), a toolbar milestone (Tileset: /
Level: labels, dropdown, New button, cursor removal), and a docs
milestone.

## Process (same discipline as v8–v16)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out.
- **No engine / data file touched.** v17 is editor-UI only. The
  level format, every `tile_lookup.json`, `level.js`, `validate.js`,
  `tileset.js`, `renderer.js`, `levels.js`, `history.js`, anything
  under `src/play/` — all untouched.

## Constraints & approach

- **Hide, don't delete.** The textarea (`#src`), gutter, ruler, and
  both splitters stay in the DOM with `display: none`. Every
  existing `src.value` consumer keeps working unchanged; a future
  version can restore the multi-pane layout by removing the hide
  rule.
- **One source of state.** Like v12/v13's CSS variables, the new
  toolbar dropdowns mutate the same `src.value` buffer the rest of
  the code already reads. The Level dropdown calls `switchTo(id)`,
  which is the v8 path the Levels-dialog already used.
- **Pure summary helper for the problems bar.** `summariseIssues
  (issues)` returns the one-line string; `renderProblems` writes it
  into the DOM. The pure half gets `node --test` coverage so the
  priority / "+N more" logic isn't only DOM-tested.

## Module map

| File | Change |
|------|--------|
| `src/style.css` | `.pane.left`, `.splitter`, `.splitter-h` → `display: none`; `.pane.right { flex: 1; width: auto }`; `.problems` rewritten as a fixed 1-line bar (no scroll); minor toolbar layout polish |
| `src/main.js` (template) | remove `<span id="cursor">`; replace `<button id="levelsBtn">Levels</button>` with `<label class="level-pick"><span>Level:</span> <select id="levelSel"></select></label>`; add `<button id="newBtn">New</button>`; change the Tileset `<span>Tileset</span>` to `<span>Tileset:</span>` |
| `src/main.js` (wiring) | new `summariseIssues(issues)` exported helper; `renderProblems` rewritten to use it (single-line output, no per-issue click rows); new `populateLevelMenu` / `syncLevelMenu` (mirror the tileset menu's pattern); `levelSel.addEventListener('change', …)` → `switchTo`; `newBtn.click` → existing `openDialog()`; `guardUnsaved(proceed, onCancel?)` gains an optional second arg so the level dropdown can snap back on cancel rather than opening a list dialog that no longer fits the v17 model |
| `src/summarise.test.js` (new) | unit tests for `summariseIssues` — `OK` when empty; error-first; warn-only when no errors; `+N more` suffix when multiple; safe on missing fields |
| `tests/splitter.spec.js` | **deleted** — the user-visible drag behaviour it asserted no longer exists (splitters are `display: none`). Pure unit tests in `src/splitter.test.js` stay |

## Milestone 1 — Layout + single-line problems bar

1. `src/style.css`:
   - Add `display: none` to `.pane.left`, `.splitter`, `.splitter-h`.
     The existing `.pane.right { flex: 1; min-width: 220px }` already
     fills the remainder when its siblings are hidden — no further
     flex-shape tweaks needed.
   - Rewrite `.problems` from
     `{ height: var(--problems-h, 25vh); overflow: auto; ... }` to
     `{ height: auto; line-height: 1.8em; padding: 6px 12px;
     overflow: hidden; white-space: nowrap; text-overflow:
     ellipsis; ... }`. Single line; ellipsis when long.
   - Keep `.problems.flash` (v9 affordance: red outline pulse when
     the playtest gate refuses).
2. `src/main.js`:
   - New `summariseIssues(issues)` pure helper, exported for tests:
     - `[]` → `'OK'`.
     - First sort errors before warnings (stable within severity);
       format the head as `<line>:<col> <severity> <message>`.
     - When `issues.length > 1`, append `· +N more` (N = remaining
       count, capped — show all if small).
   - `renderProblems(issues)` becomes:
     - `problemsEl.textContent = summariseIssues(issues)`.
     - Set `problemsEl.className = 'problems ' + severityClass(issues)`
       (or use a data-attr) so the colour matches err/warn/dim.
     - Drop the per-row click-to-jump handlers (no caret to position
       in the hidden textarea).
   - The flash trigger in `tryPlaytest` keeps working unchanged.
3. `src/summarise.test.js` (new):
   - Empty / single-error / single-warn / multi-error / multi-mixed /
     missing-field cases. Pure; no DOM.
4. `tests/splitter.spec.js`: **deleted**.

Commit: `v17 m1: hide text pane + splitters; single-line problems bar (tested)`.

## Milestone 2 — Toolbar: Tileset:, Level:, New, cursor removal

1. `src/main.js` (template, inside `#app` innerHTML):
   - Remove `<span id="cursor">cursor —</span>`.
   - Replace the Levels button:
     ```html
     <label class="level-pick" title="Switch level">
       <span>Level:</span>
       <select id="levelSel"></select>
     </label>
     <button id="newBtn" title="New level">New</button>
     ```
   - Change the Tileset span text from `Tileset` to `Tileset:`.
2. `src/main.js` (wiring), all next to the existing tileset menu
   helpers:
   - `populateLevelMenu()`: `await levels.list()` (already returns
     `[{id, name, modified}]` from the v8 manifest); render options;
     prefix `●` on modified entries.
   - `syncLevelMenu()`: set `levelSel.value = currentId` after every
     `setBuffer` / `applyHistory` / `loadInto`. Mirrors
     `syncTilesetMenu` from the v12 path.
   - `levelSel.addEventListener('change', () => { … guardUnsaved(
     () => loadInto(levelSel.value), () => { levelSel.value =
     currentId; } ); })`.
   - `newBtn.addEventListener('click', openDialog)` — opens the
     existing levels dialog; the user clicks New from there. (Minor
     UI redundancy — the dialog still shows the level list — but
     no behaviour change risk. A v18 candidate is to add a
     "new-only" dialog variant.)
   - `guardUnsaved(proceed, onCancel)` — second optional arg:
     ```js
     onChoice: (choice) => {
       if (choice === 'cancel') return onCancel ? onCancel() : openDialog();
       if (choice === 'save') levels.save(currentId, src.value);
       proceed();
     }
     ```
     Existing call sites omit `onCancel` and fall back to
     `openDialog()` — back-compat.
   - Repopulate / re-sync the level menu when the level list could
     have changed (e.g. after `levels.save` updates a draft's
     `modified` flag, after `levels.revert`).
3. The `caretLineCol` / `lineColToCaret` / `updateCursor` helpers
   are NOT removed — they harmlessly query a `#cursor` element that
   no longer exists (DOM `null` → assignment no-op). v18 cleanup
   candidate; keeping them in v17 reduces the diff to the
   essentials.

Commit: `v17 m2: toolbar — Tileset:/Level: labels, level dropdown, New button, cursor removed`.

## Milestone 3 — Docs + transcript + Delivered

1. `TDDs/3_transcripts/version17_build.md` (narrative, v8–v16
   style).
2. Mark design + impl Delivered with hashes; tick acceptance.

Commit: `v17 m3: docs + v17 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is the only milestone that touches layout.** Risk is a
  Playwright spec breaking on hidden elements — explicitly: the
  splitter spec is deleted in this same commit. The other Playwright
  specs (tileset-screenshots, playtest-tileset, playtest-animation)
  operate on right-pane elements (`#tilesetSel`, `#preview`,
  `#legend`, `.playtest canvas`) which stay visible.
- **M1 may shift the v10 preview-canvas md5s** slightly (the right
  pane is wider now → the canvas's on-screen position shifts → the
  compositor anti-aliases at a different sub-pixel offset). The v10
  *distinctness* assertion is pairwise — each tileset still hashes
  uniquely, just at new values. Same pattern v12 M1 documented.
- **M2 is the only behavioural change to event wiring.** The Level
  dropdown's cancel-snap (onCancel resetting `levelSel.value`) is
  the one subtle bit — without it, a user picks "Cancel" in the
  unsaved-changes prompt and the dropdown is stuck displaying the
  level they didn't switch to.
- **The dropdown's `change` event fires even when programmatically
  setting `.value`.** Mitigation: do programmatic updates via a
  setter that suppresses the next change event (small guard flag in
  the wiring), OR — simpler — check `next === currentId` at the top
  of the change handler and exit immediately. We do the latter
  (cheap, same pattern as `switchTo`).
- **No deploy risk.** Bundle shrinks slightly (less click-to-jump
  wiring, splitter spec gone); CSS shrinks marginally. Pages
  workflow unchanged.

## Deferred (design §9 → v18+)

- **Rename current level** — a small input button next to Download.
- **Theme toggle** — third toolbar dropdown if multi-theme tilesets
  arrive.
- **Resize level** — a "Resize…" dialog (clamped 4–200).
- **`// comments`** — probably moot.
- **A "Show text pane" toggle** — fallback if the lost text-pane
  affordances above feel awkward as separate UI.
- **Cleanup of the now-dead-end `caretLineCol` / `updateCursor`
  helpers** — kept in v17 to minimise diff risk.
- **Per-cell animation phase**, **pause-aware animation**,
  **multi-row atlases**, **state-changing exit** — long-standing
  candidates carried forward.
