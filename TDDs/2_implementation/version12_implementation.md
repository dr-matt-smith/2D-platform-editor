# Version 12 — Implementation Plan

Status: Proposed · Date: 2026-05-20 · Design:
[../1_design/version12_design.md](../1_design/version12_design.md)

A single focused feature: a draggable vertical splitter between the
text and canvas panes. Three small path-scoped commits; one
behavioural change in the layout system, isolated to two new files +
one CSS edit + one DOM insert.

## Process (same discipline as v8–v11)

- **One milestone per commit.** Before each: `npm test` green,
  `npm run test:e2e` green, `npm run build` clean,
  `npm run build:pages` clean.
- **Path-scoped `git add` only.** The user's in-flight `fred.txt` /
  `above_ground2.txt` / `manifest.json` / `__temp/wish_list.md` stay
  out. Memory: [[scoped-git-add]].
- Pure parts unit-tested under `node --test`; the live drag is
  Playwright-tested.

## Constraints & approach

- **Zero impact on existing modules.** Splitter logic lives in its
  own `src/splitter.js`; the only edits elsewhere are a `<div>` insert
  in `main.js`'s template, a CSS swap (`flex: 1` → `width:
  var(--left-pct)`) on `.pane.left`, and one `setupSplitter()` call
  during startup.
- **CSS variable drives layout.** Drag handlers mutate
  `document.documentElement.style.setProperty('--left-pct', '<px>px')`
  — no inline width assignments on the pane element itself, so the
  flexbox machinery stays clean.
- **Pure clamp + persistence helpers** (small but real test surface)
  live in `splitter.js`'s top-level exports so `node --test` can hit
  them without a DOM.

## Module map

| File | Change |
|------|--------|
| `src/style.css` | `.pane.left` width-driven via `--left-pct` (default `50%`); `.pane.left` border removed; new `.splitter` rule (6 px, `col-resize`, hover tint) |
| `src/main.js` | insert `<div class="splitter" id="splitter"></div>` between the two panes; import + call `setupSplitter()` at startup |
| `src/splitter.js` (new) | `setupSplitter({ storage, doc, win })` — sets initial width, wires pointer-down / pointer-move / pointer-up / dblclick; pure helpers `clampPx(px, minLeft, minRight, viewportW)` and `loadInitial(storage, viewportW)` exported for tests |
| `src/splitter.test.js` (new) | unit tests for the pure helpers |
| `tests/splitter.spec.js` (new Playwright) | drag-changes-width, reload-preserves, double-click-resets |

## Milestone 1 — Layout swap + visible splitter (no JS drag yet)

1. `src/style.css`:
   - Replace `.pane { flex: 1; min-width: 0; ... }` with:
     - `.pane.left { width: var(--left-pct, 50%); min-width: 220px; ... }`
     - `.pane.right { flex: 1; min-width: 220px; ... }`
   - Remove `border-right` from `.pane.left` (the splitter element
     replaces it visually).
   - Add `.splitter { width: 6px; cursor: col-resize; background: var(--line); flex: 0 0 auto; }` plus `.splitter:hover { background: var(--accent or similar); }` and `.splitter.dragging { background: ...; }` (subtle "active" tint).
2. `src/main.js`: insert `<div class="splitter" id="splitter" title="Drag to resize · double-click to reset"></div>` between the two panes in the `#app` template.
3. **No JS yet.** Page should render with a visible 6 px bar; resizing the window or hand-typing `:root { --left-pct: 30%; }` in DevTools moves the divider. Build clean; Playwright still green.

Commit: `v12 m1: visible splitter element + width-driven layout`.

## Milestone 2 — Drag handler + persistence + tests

1. `src/splitter.js`:
   - Exported pure helpers:
     - `clampPx(px, minLeft, minRight, viewportW)` → integer between
       `minLeft` and `viewportW - minRight`; OOR inputs clamp.
     - `loadInitial(storage, viewportW, minLeft, minRight)` → pixel
       width to apply at startup; reads `ld:v12:splitter`; falls back
       to `Math.round(viewportW / 2)`; clamps.
   - `setupSplitter({ doc = document, win = window, storage = localStorage })`:
     - Set initial `--left-pct` to `loadInitial(...) + 'px'`.
     - On `pointerdown` on `#splitter`: `setPointerCapture`, mark `.dragging` class, listen for `pointermove`/`pointerup`.
     - `pointermove`: `clampPx(e.clientX, 220, 220, win.innerWidth)`, write `--left-pct`.
     - `pointerup`: persist current width to storage; remove the dragging class.
     - `dblclick` on the splitter: clear storage, set `--left-pct` to `50%` (string, not px — so a window resize keeps it half).
   - Defensive storage shim mirrors the `levels.js` one (private-mode → in-memory Map).
2. `src/main.js`: `import { setupSplitter } from './splitter.js'; setupSplitter();` near the other startup wiring (after `populateTilesetMenu`).
3. `src/splitter.test.js`: `node --test`. Cases:
   - `clampPx`: in-range value returned as-is; below `minLeft` → `minLeft`; above `viewportW - minRight` → that ceiling; tiny viewport (< minLeft+minRight) → returns minLeft.
   - `loadInitial`: storage hit → that integer (clamped); storage miss → `viewportW/2`; junk in storage → fallback.

Commit: `v12 m2: splitter drag + persistence + reset (tested)`.

## Milestone 3 — Playwright e2e + docs

1. `tests/splitter.spec.js`: a single `serial` test that
   - launches the editor, reads `.pane.left`'s width,
   - drags `#splitter` +120 px right,
   - asserts the left pane is ~120 px wider (±2 px slack for rounding),
   - reloads the page and asserts the width is preserved,
   - double-clicks the splitter and asserts the left pane returns to ≈ half the viewport.
2. The existing `tileset-screenshots.spec.js` is unaffected — the
   distinctness assertion compares preview canvases, which the
   splitter doesn't influence.
3. `TDDs/3_transcripts/version12_build.md` (narrative, v8–v11 style);
   mark design + impl Delivered with hashes.

Commit: `v12 m3: playwright splitter spec + v12 transcript; plan + design Delivered`.

## Risks & sequencing

- **M1 is structural** — the layout swap could subtly break flex
  alignment of the right pane. Mitigation: rerun the existing
  Playwright capture (Dirt + the four packs) after M1 — the preview
  canvas hashes should be **byte-identical** because nothing draws
  differently, just the surrounding panes occupy different widths.
  If hashes change it's because canvas re-fit changed the
  intrinsic size — the renderer already resizes the canvas to grid
  dims regardless, so this should not regress.
- **M2 is the only behavioural change.** Pointer events handle mouse
  + trackpad + touch uniformly. The `pointercapture` API ensures the
  drag follows the cursor outside the splitter rect even when moving
  fast.
- **Storage is best-effort** — a private-mode failure degrades to
  in-memory (drag still works for the session; doesn't persist).
- **No deploy risk** — bundle grows by a small JS module + a few CSS
  rules; Pages workflow is unchanged. Live URL stable.

## Deferred (design §9 → v13)

Keyboard nudging on a focused splitter; vertical splitting of the
right pane (canvas vs. legend / problems); per-level splitter width;
a "collapse" button; a second splitter inside the right pane.
