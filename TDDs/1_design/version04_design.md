# 2D Level Designer — Version 4 Design Document

Status: Draft · Date: 2026-05-18 · Builds on:
[version03_design.md](version03_design.md)

## 1. Purpose

Two related changes:

1. **Autotile face correction** — for the above-ground level the rocky dirt
   face currently points the wrong way at the level's bounding edges. The dirt
   should read as the *outside frame of a rectangular play area*, with its
   textured face toward the player (the interior), not off the edge of the map.
2. **Rectangle draw tool** — the long-deferred rectangle fill (dropped in v1,
   backlogged since), drawing dirt rectangles whose edges pick the correct
   outward/inward-facing tiles automatically via the same rule.

## 2. The tile-face problem

Current rule (`renderer.js` `autotileIndex`):

```
up/down/left/right = solid neighbour?      // off-grid → treated as OPEN
row = !up   ? 0 : !down  ? 2 : 1
col = !left ? 0 : !right ? 2 : 1
tile = dirt[row*3 + col]                   // 9-slice: TL T TR / L C R / BL B BR
```

Because off-grid counts as **open**, a dirt cell on the map boundary thinks
there is open space *outside* the map and turns its rocky face outward — off
the screen — instead of toward the play area. So in above-ground the left
boundary wall renders `dirt_left` (rim facing off-map) when it should present
`dirt_right` (rim facing the player, who stands to its right).

The user's intent, by example:

| Level edge | Should use | Why |
|------------|------------|-----|
| Left wall | `dirt_right` | rim faces right, toward the player inside |
| Right wall | `dirt_left` | rim faces left, inward (already correct) |
| Floor | `dirt_top` | rim faces up — the surface the player walks on |
| Ceiling | `dirt_bottom` | rim faces down, into the room |

## 3. The fix — one rule change

**Treat off-grid neighbours as SOLID, not open.** The world is an implicit
infinite block of dirt; the level carves play space *out of* it. Nothing else
in `autotileIndex` changes. Worked through against the 9-slice mapping:

- **Left boundary wall** (`c = 0`, open play area to the right): left = off-grid
  = solid, right = open → `col = 2` → `dirt_right`. ✓
- **Right boundary wall** (`c = W-1`): right = solid, left = open → `col = 0`
  → `dirt_left`. ✓
- **Floor** (bottom row, full width): below = solid, above = open → `row = 0`
  → `dirt_top`. ✓
- **Ceiling**: above = solid, below = open → `row = 2` → `dirt_bottom`. ✓
- **Free-standing solid block** (pillar/platform, not at the map edge): its
  edge cells still have genuinely open neighbours outside the block, so the
  rim still faces outward, away from the block's solid centre — unchanged.

That single flip satisfies every case the user listed, and leaves all
non-boundary structures (above-ground's pillars, below-ground's tunnels)
exactly as they render today, because the change only affects cells whose
neighbour is *off the grid*.

## 4. Platform depth principle (documented, not enforced)

> **Superseded by v5.** The 1-deep `dirt_top`+caps treatment below is replaced
> by purpose-built platform tiles (a 1-thick run renders the
> `platform_*` set, an isolated cell `platform_single`). See
> [version05_design.md](version05_design.md). The depth *authoring guidance*
> still holds; only the rendered tiles changed.

- A horizontal platform **≥ 2 tiles deep** can show outward dirt on every
  face: `dirt_top` on the walked surface, `dirt_bottom` underneath,
  `dirt_left`/`dirt_right` ends, `dirt_center` inside. This looks best.
- A **1-tile-deep** platform is a single row: `row` precedence picks
  `dirt_top` (the walk surface) across, with `dirt_top_left` /
  `dirt_top_right` ends. Acceptable and intended — no underside to show.

This is editor/authoring guidance surfaced in docs and (optionally) a
soft validator hint; it is **not** a hard validation rule.

## 5. below-ground interaction — RESOLVED

below-ground's outer ring is 2-thick solid dirt. Under off-grid-solid, that
ring becomes `dirt_center` (solid on all sides) instead of edge tiles — the
*interior* tunnel faces the player sees are byte-for-byte unchanged, only the
never-played outermost rim loses its decoration.

**Decision (visually verified):** before/after renders confirmed the
below-ground interior is identical and the outer-rim change is a slight
improvement (drops a redundant off-screen frame). **Ship the single global
off-grid-solid rule. No theme-gating.** The theme-gate fallback is dropped,
not deferred.

## 6. Rectangle draw tool

Rendering is grid-driven — the renderer autotiles from glyph neighbours — so a
rectangle tool only needs to write `#` and the §3 rule does the faces for
free. Scope:

- **Filled rectangle** — drag a rectangle in the preview (or enter
  coordinates), fill with `#` (or the active glyph). Edges pick
  outward/inward-facing tiles automatically.
- **Outline rectangle** — walls only, hollow interior (drawing a room); the
  same rule makes the walls face the interior.
- Pulls in the **custom undo stack** (long noted: non-text edits bypass native
  textarea undo). The fill is a pure `fillRect(grid,…)`/`outlineRect(grid,…)`
  helper in `level.js` so it is unit-tested without a DOM, then mirrored back
  into the textarea buffer.
- Active glyph selection (defaulting to `#`) so the tool also works for `.`
  (erase), and entities later.

## 7. Architecture / impact

- **`renderer.js`** — `solid()` returns `true` for off-grid; one-line change.
  Update the `autotileIndex` comment. Decor passes already use the in-bounds
  guard, so they are unaffected.
- **`level.js`** — new pure `fillRect` / `outlineRect` helpers.
- **`main.js`** — pointer-drag selection on the preview canvas, glyph picker,
  undo/redo stack and key bindings, buffer mirroring.
- **`renderer.js` (optional)** — a selection-overlay arg (kept pure: data in,
  pixels out).
- `validate.js` untouched; tests extended for the new rule and helpers.

## 8. Open questions

- ~~below-ground / theme-gate~~ — **resolved**, single global rule (§5).
- **Undo granularity** — per-edit snapshots (simple, more memory) vs. diffs.
  Recommend whole-buffer snapshots with a cap; revisit if large levels strain.
- **Tool affordance** — keyboard/drag only, or a small toolbar? A toolbar is
  the first persistent chrome beyond the status bar; scope deliberately.
- **Selection overlay purity** — pass selection to `draw()` vs. a separate
  overlay canvas. Lean overlay canvas to keep `draw()` signature stable.

## 9. Milestones

All milestones delivered — see
[../2_implementation/version04_implementation.md](../2_implementation/version04_implementation.md)
for commit hashes.

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | off-grid-solid rule + tests; re-verify both example levels render correctly (screenshot-faithful) | done |
| 2 | Pure `fillRect` / `outlineRect` in `level.js` + unit tests | done |
| 3 | Undo/redo stack (whole-buffer snapshots) + key bindings | done |
| 4 | Preview drag-selection + glyph picker → fill/outline, buffer mirrored | done |
| 5 | Docs + v04 transcript; platform-depth guidance into `data/levels/README.md` | done |

## 10. Acceptance criteria

- above-ground: left wall `dirt_right`, right wall `dirt_left`, floor
  `dirt_top`, ceiling `dirt_bottom`; pillars/platforms unchanged.
- below-ground interior unchanged; outer-ring change accepted (single global
  rule, no theme-gate — §5).
- A 1-deep platform renders `dirt_top` (+ correct end caps); a ≥2-deep one
  shows outward faces on all four sides.
- Dragging a rectangle fills `#`; its edges autotile to outward/inward faces
  with no manual tile choice; undo reverts it in one step.
- `fillRect`/`outlineRect` are pure and unit-tested; `npm test` green,
  `npm run build` clean.

## 11. v5 candidates

Flood fill + line tool (share the selection/undo machinery); per-tile variant
randomisation; reachability lint; the still-open play-test runtime (v2 §6).
