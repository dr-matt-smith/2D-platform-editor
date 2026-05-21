# 2D Level Designer — Version 17 Design Document

Status: **Delivered** · Date: 2026-05-21 · Builds on:
[version14_design.md](version14_design.md) (the editor renderer is the
single source of pixel truth) and the v12/v13 splitter work (whose
multi-pane affordance v17 deliberately retires for everyday authoring)
· Built:
[../2_implementation/version17_implementation.md](../2_implementation/version17_implementation.md)
(M1–M3, all §7 acceptance met) ·
[../3_transcripts/version17_build.md](../3_transcripts/version17_build.md)

## 1. Purpose

The four UX changes the user requested all push the editor away from
its v1 "ASCII grid in a textarea + live preview canvas" mental model
toward a **graphical-only editing surface**:

1. Hide the top-left text-file representation of the level.
2. Make the bottom message panel **fixed-height, single line**.
3. Add the colon to the **"Tileset:"** label, and add a **"Level:"**
   labelled dropdown that switches levels directly from the toolbar.
4. Remove the cursor / line readout — there's no visible text caret
   to report on.

The graphical workflow has been the *primary* one for authors since
the legend + drag-to-fill landed back in v3/v4; v17 finally makes it
the *only* visible one. The text pane stays in the DOM (hidden), so
every existing parse/serialize/edit code path keeps working — only
the visible representation changes.

## 2. Current state

The right pane is already the graphical surface (canvas + legend +
toolbar). The left pane (textarea + gutter + column ruler) was the
original editing surface but has been mostly redundant for several
versions:

- v3+ legend click → set active glyph.
- v4+ drag-rectangle on the preview canvas → `applyEdit(text)` writes
  back into the textarea.
- v12 splitter let authors widen whichever side they preferred — and
  the most common configuration in practice was to grow the canvas
  and shrink (or ignore) the text pane.

Today the toolbar has:

```
[Levels] [Download] [Play] Tileset [▾]  cursor (x N, y N) · line N
                                                          ● unsaved
```

…and the problems panel below the editor is resizable (v13) and lists
every issue as a clickable row.

## 3. Mental model (v17)

The textarea becomes an **internal buffer**, not a user surface. Every
existing call to `src.value` (parse, apply edits, history) keeps
working — `<textarea>` survives in the DOM with `display: none`.

Authors interact with the level through:

- The **legend** (click a glyph to make it active).
- The **preview canvas** (drag a rectangle to fill, Shift+drag for
  outline).
- The **toolbar** (Tileset/Level dropdowns, Play, Download).

There's no longer a place for hand-typed `// comments`, non-default
`# theme: cave`, or `# name:` renames — see §9 non-goals.

## 4. The four UX changes in detail

### 4.1  Hide the text-file representation

CSS hides `.pane.left` and **both splitters** (`.splitter` from v12,
`.splitter-h` from v13). The right pane takes the full editor width.

The textarea (`#src`), the gutter (`#gutter`), and the column ruler
(`#rulerCol`) stay in the DOM but are unreachable visually. The v12
`--left-pct` custom property no longer affects anything (the left
pane is `display: none`). The v13 `--problems-h` is overridden — see
§4.2.

Why hide instead of delete? Every consumer of `src.value` still works
without code changes. A future version that wants to bring back the
text pane (toggleable advanced mode?) needs no DOM surgery — just
remove the CSS hide. Cheap defensive call.

### 4.2  Single-line, fixed-height messages bar

`.problems` becomes:

- `height: 1.75em` (one line of text + padding), no longer
  `var(--problems-h, 25vh)`.
- `overflow: hidden` (no scroll; messages are summary-only).
- Content: one of the following, in priority order:
  - `OK` (no issues), in `var(--dim)`.
  - `<line>:<col> error <message>` (first error), in `var(--err)`.
  - `<line>:<col> warn <message>` (first warning, if no error), in
    `var(--warn)`.
  - For multiple issues: trailing `· +N more` count.

The click-to-jump behaviour is dropped (there's no caret to position
in a hidden textarea). The `.problems.flash` animation from v9 (used
when the playtest gate refuses to launch) stays — flashing the bar
red is still the right "look, there's a blocker" signal.

### 4.3  "Tileset:" + "Level:" labelled dropdowns

Toolbar layout becomes:

```
[Download] [Play] [New] Level: [▾]  Tileset: [▾]  ● unsaved
```

- **"Tileset:"** — change the label text from `Tileset` to
  `Tileset:` (one-character change in `main.js`'s `innerHTML` for the
  `.tileset-pick > span`).
- **"Level:"** — a new `<select id="levelSel">` populated from the
  existing levels manifest (`levels.list()`), labelled with a colon-
  suffixed span the same way Tileset is. Selecting an option calls
  the existing `switchTo(id)` — which carries the v8 unsaved-changes
  guard (`guardUnsaved` will prompt save/discard/cancel just as it
  does today when a user picks a level from the dialog).
- **"Levels" button** retired (the dropdown replaces it).
- **"New" button** kept (or new — was inside the Levels dialog
  today): opens the existing `openLevelDialog(...)` so the "New
  level" flow (tileset + size chooser) stays reachable.
- **"Download"** button kept.

Level-list changes (new draft saved; a level revert) re-populate the
`#levelSel` options the way `populateTilesetMenu` already does for
the tileset menu.

Levels that match the active buffer's `currentId` are pre-selected
in the dropdown; switching is the only intent (no per-row download
in the dropdown — Download targets the active buffer via the
existing button).

### 4.4  Remove the cursor / line readout

The `<span id="cursor">cursor —</span>` is deleted. The
`caretLineCol` / `updateCursor` / `lineColToCaret` helpers can stay
(they're called from `setBuffer` / `applyHistory` / textarea event
listeners) — they harmlessly write to a `#cursor` element that no
longer exists. The DOM lookups return `null` and the assignments
no-op. A v18 cleanup could remove them, but doing so in v17 adds
risk for zero user payoff.

The `<span id="dirty">● unsaved</span>` indicator **stays** —
unsaved status is still meaningful in the graphical model (your
draft hasn't been persisted yet).

## 5. Architecture / impact

| File | Change |
|------|--------|
| `src/style.css` | hide `.pane.left`, `.splitter`, `.splitter-h`; make `.pane.right` take full width regardless of `--left-pct`; rewrite `.problems` as a fixed 1-line bar (no scroll); minor toolbar layout polish so the two dropdowns + labels read cleanly |
| `src/main.js` | template: remove `<span id="cursor">`, replace `<button id="levelsBtn">` with `<label class="level-pick">Level: <select id="levelSel"></select></label>`; add a `<button id="newBtn">New</button>` (replacing the Levels dialog's New-level affordance); change `Tileset` to `Tileset:` |
| `src/main.js` | wiring: `populateLevelMenu()` (mirrors `populateTilesetMenu`); `syncLevelMenu()` (mirrors `syncTilesetMenu`); `levelSel.addEventListener('change', …)` → `switchTo(id)`; `newBtn.click` → opens the existing levels dialog in "new level" mode (or a smaller "new only" variant) |
| `src/main.js` | `renderProblems(issues)` rewritten to emit one summary line (priority order in §4.2); the `.flash` class wiring on a blocked playtest gate stays |
| `src/splitter.js` | **unchanged**; setupSplitter / setupProblemsSplitter still wire to `#splitter` / `#splitterH` which are still in the DOM. With those elements `display: none`, no pointer events fire — the modules become harmless no-ops |
| `tests/splitter.spec.js` | **deleted**; the splitters are no longer a user-visible feature, so end-to-end drag assertions don't apply. The pure unit tests in `src/splitter.test.js` stay (cheap to keep, document the helpers) |
| `tests/tileset-screenshots.spec.js` / `playtest-tileset.spec.js` / `playtest-animation.spec.js` | unchanged (preview + playtest behaviour all carries through unchanged) |

The level-format parser / validator / playtest / renderer / adapter
— **none** are touched. v17 is purely an editor-UI change.

## 6. Open questions — proposed defaults

- **Hide vs delete the text pane?** — Hide (CSS). Keeps every
  `src.value` consumer working; cheap defensive call.
- **Single-line message format?** — `OK` when clean; `line:col
  error/warn message · +N more` when one or more issues. Priority:
  first error before first warning.
- **Where does "New level" live?** — Keep a `[New]` button in the
  toolbar (calls the existing levels-dialog's "new" flow). Don't
  bury it in the level dropdown.
- **Does the level dropdown also show "modified" badges** (drafts
  with unsaved changes)? — Yes, mirror what the levels dialog does:
  a `●` prefix on modified entries. Simple and informative.
- **Splitter Playwright specs?** — Delete (the user-visible
  behaviour they asserted no longer exists). Splitter unit tests
  stay (cheap).
- **The v13 `--problems-h` persistence** (the user might have
  dragged the panel before v17) — leaving the `localStorage` key
  in place is harmless: nothing reads it after v17, and a future
  version that brings the splitter back would resume from that
  value. No migration / cleanup needed.

## 7. Acceptance criteria

- Opening the editor: no text pane visible; no vertical splitter;
  the canvas + legend fill the editor area; the message bar at the
  bottom is one line tall.
- Toolbar: `Tileset:` and `Level:` labels both have colons; the
  Level dropdown lists every level in the manifest; the active
  level is pre-selected; switching the dropdown switches the level
  (with the existing unsaved-changes guard).
- The cursor `(x N, y N) · line N` readout is gone.
- The message bar reads `OK` on a clean level and
  `line:col error/warn message [· +N more]` otherwise.
- A blocked playtest gate still flashes the message bar red (v9
  affordance).
- All `src.value` flows still work: legend click + drag-rectangle
  paints; history undo/redo (Ctrl+Z / Ctrl+Shift+Z); save/load
  via the levels dialog (still reachable through the New button →
  cancel-out); Download exports the current buffer.
- `npm test` green; `npm run test:e2e` green (12 → 11 after
  retiring the splitter spec; or `+0` if the spec is kept skipped);
  both builds clean.

## 8. Non-impact (explicit)

- Level format, all `tile_lookup.json` files, `level.js`,
  `validate.js`, `tileset.js`, `renderer.js`, `levels.js`,
  `history.js`, anything under `src/play/` — unchanged.
- The playtest, distinctness gate, animated playback (v16) — all
  carry through unchanged.
- The legend's per-glyph click-to-set behaviour, the drag-rectangle
  fill / outline tool, undo/redo, drafts in localStorage, the
  `# tileset:` directive synced from the Tileset dropdown — all
  unchanged.

## 9. Non-goals (deliberate trade-offs) + v18+ candidates

The text pane was the only place authors could:

- Hand-edit the `# name:` directive (rename a level).
- Toggle `# theme: cave` ↔ `# theme: sky`.
- Change `# size:` (resize a level after creation).
- Add `// comments` inline.

v17 deliberately drops all of those for everyday authoring. Each
returns as a v18+ candidate if the workflow actually misses them:

- **Rename current level** — a button next to Download, or a
  rename input inline.
- **Theme toggle** — a third toolbar dropdown (`Theme: [sky▾/cave]`)
  if multi-theme tilesets ever ship.
- **Resize level** — a "Resize…" dialog (clamped to 4–200 like the
  New-level chooser); harder than rename because the grid contents
  need to be re-laid-out.
- **Comments** — probably defunct; commenters can edit raw `.txt`
  files outside the editor.
- **Bring the text pane back behind a toggle** — if any of the
  above feel awkward as separate UI, restoring the pane behind a
  "Show text pane" toggle is a fallback. The v17 hide-not-delete
  choice keeps that path cheap.

Other carry-over v18+ candidates from earlier versions:

- **Per-cell animation phase offset** (v16 §8).
- **Pause-aware animation** (game-time accumulator).
- **Multi-row tile atlases** (Treasure Hunters palm-terrain).
- **State-changing exit** (`imageActive`).
- **Keyboard nudge** on the (now-hidden) splitters — moot until
  splitters return.
