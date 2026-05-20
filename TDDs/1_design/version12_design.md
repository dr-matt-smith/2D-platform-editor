# 2D Level Designer — Version 12 Design Document

Status: **Delivered** · Date: 2026-05-20 · Builds on:
[version11_design.md](version11_design.md) (concludes the tileset
schema arc) · Built:
[../2_implementation/version12_implementation.md](../2_implementation/version12_implementation.md)
(M1–M3, all §7 acceptance met) ·
[../3_transcripts/version12_build.md](../3_transcripts/version12_build.md)

## 1. Purpose

The editor today splits its viewport **50/50** between the text pane
(left: textarea + gutter + ruler) and the graphical pane (right:
canvas + legend + toolbar). The split is hardcoded in CSS — neither
pane can be widened. v12 makes the dividing line **draggable** so the
author can give whichever side they're working on more room
(e.g. wide text levels need a wider left; small grids let the canvas
shrink so the textarea claims most of the screen).

A single, focused feature. The richer tileset work continues to be
v11+1 / v13 territory.

## 2. Current state

`src/style.css`:

```css
.editor      { display: flex; flex: 1; min-height: 0; }
.pane        { flex: 1; min-width: 0; ... }
.pane.left   { border-right: 1px solid var(--line); }
```

`.editor` is a horizontal flexbox; each `.pane` has `flex: 1` so the
ratio is forever 1:1. The visible "dividing line" today is just the
1-pixel right border on `.pane.left` — it has no drag affordance.

## 3. UX

- A **visible draggable bar** (~6 px wide) sits between the two panes.
  Hover → `cursor: col-resize`; the bar tints slightly so the
  affordance is discoverable. Dragging is **horizontal only**.
- **Min widths**: 220 px on each side (room for at least a column of
  monospaced text on the left and the toolbar/legend on the right).
  Drags clamp to that range.
- **Double-click the splitter** → reset to 50/50 (cheap "undo of all
  my dragging" gesture, no extra UI).
- **Persisted** across reloads via `localStorage` (key
  `ld:v12:splitterPct`), so a returning user finds the layout they
  left.
- **Pointer events** drive the drag → covers mouse, trackpad, **and
  touch** with no extra code.
- **No keyboard support in v12.** Arrow-key nudging on a focused
  splitter is a small v13 polish (deferred §9).

## 4. Architecture / impact

Two real changes. Everything else (legend, problems panel, canvas,
preview rendering, validate, adapter, playtest) is untouched.

| File | Change |
|------|--------|
| `index.html` / `src/main.js` | a new `<div class="splitter" id="splitter">` inserted between `.pane.left` and `.pane.right`. The existing `.pane.left` border is removed (the splitter is the new visible divider). |
| `src/style.css` | swap the two panes from `flex: 1` to **width-driven**: a CSS variable `--left-pct` (default `50%`) drives `.pane.left { width: var(--left-pct); }` and `.pane.right { flex: 1; }` (right takes the remainder). The splitter has fixed width (~6 px) + `cursor: col-resize`. |
| `src/splitter.js` (new) | a small pure-DOM module: pointer-down on the splitter starts a drag, pointer-move updates `document.documentElement.style.setProperty('--left-pct', '<x>px')`, pointer-up persists. Double-click resets. |
| `src/main.js` | imports `setupSplitter` and calls it once at startup. |
| `tests/splitter.spec.js` (new Playwright) | drags the splitter, asserts the left pane grows; reload preserves; double-click resets. |

### Width units

Splitter position is **stored in px** in `localStorage` rather than a
percentage. Rationale: when the window resizes, a percentage would
keep the same ratio (which is fine), but pixel width keeps the *text
column count* stable — which is the property authors care about most
(they tend to size the textarea to comfortably fit N columns of grid
plus the gutter). Initial state for a fresh user is **50%** of the
viewport width (computed once and persisted, so the first drag is
relative to a sensible anchor).

`--left-pct` is a CSS custom property declared on
`document.documentElement`; changing it is one assignment per drag
move with no layout-thrashing intermediate JS (the browser does the
work).

## 5. Persistence

- Key: `ld:v12:splitter` (the namespace already used by `levels.js`).
- Value: an integer pixel width (e.g. `"640"`).
- Read once at startup; missing/parse-failed → fall back to half the
  current viewport width.
- Reset (double-click) clears the key AND sets the variable back to
  50%.
- Storage uses the same defensive shim pattern as `levels.js` (private
  mode → in-memory Map; the splitter keeps working, just not
  persistent).

## 6. Open questions — RESOLVED (recommended defaults)

- **Splitter visual** — visible 6 px bar with a subtle hover tint
  (rather than invisible drag-on-border). Discoverability wins.
- **Min widths** — 220 px each side, pixel-based. Percentages get
  weird on very narrow / very wide windows.
- **Storage value** — pixels, not percent (see §4 "Width units").
- **Default** — 50%, computed against the current viewport.
- **Double-click reset** — yes; minimal, no new UI.
- **Keyboard nudge** — deferred to v13.
- **Touch** — covered by pointer events; no separate handler.

## 7. Acceptance criteria

- A visible 6 px vertical bar appears between the text pane and the
  canvas pane, with a `col-resize` cursor on hover.
- Drag → left pane width changes live; right pane fills the remainder.
- Dragging beyond the clamps (left or right) stops at 220 px on the
  near side.
- Reload preserves the dragged width.
- Double-click the splitter → both panes return to 50/50 and
  `localStorage` is cleared.
- The existing playtest, legend thumbnails, ruler, gutter, problems
  panel, and preview canvas continue to render and align as before
  (no overflow, no double-scrollbars). The canvas re-sizes naturally
  because its container's width changed — no JS poke required.
- All `node --test` and Playwright e2e suites still green; v12 adds
  one new Playwright spec covering drag, persistence, and reset.

## 8. Architecture / non-impact

Explicitly **not** touched:

- `level.js`, `validate.js`, `tileset.js`, `renderer.js`,
  `levels.js`, `history.js`, the `play/*` modules — none of these
  read pane widths.
- `tile_lookup.json` files and the levels manifest — pure data.
- The level format. The Playwright distinctness/screenshot tests
  continue to capture preview canvases unchanged.

## 9. Non-goals + v13+ candidates

- **Vertical splitting** of the right pane (canvas above, problems
  panel below as a movable section) — a likely v13 if needed.
- **Per-level splitter width** — overkill; one global value suffices.
- **Keyboard nudge** on a focused splitter (Left/Right arrows ± 8 px,
  Home → centre) — small polish, v13.
- **Collapse-to-zero** with a "show pane" button — interesting if a
  user wants to fully hide one pane, but covered by 90/10 dragging in
  practice.
- A second splitter inside the right pane (canvas vs. legend or
  canvas vs. problems) — out of v12.
