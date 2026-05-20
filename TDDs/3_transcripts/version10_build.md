# Transcript — Version 10: Tileset-Aware Preview Renderer

A narrative record of the v10 phase: fixing the **v8 decor-atlas limit**
that the user spotted in practice and the Playwright harness made
unarguable. Decisions and rationale, in order.

## How the bug surfaced

The user added four new tilesets, dropped artwork into
`public/data/tilesets/`, and asked for `tile_lookup.json` + a toolbar
tileset menu. After that landed, the user reported: "*when I change
tilesets, except for the dirt tileset, the tiles I see for the level all
look the same*". The Playwright harness I'd just written made it
unambiguous: three non-Dirt preview canvases hashed **byte-identically**
(`md5 2ba7f2c8…`) — the legend showed each tileset's art correctly, but
the canvas didn't. The v8 implementation plan §risks had explicitly
flagged this: "Decor is still Dirt-atlas-bound. v8 makes filled tiles
tileset-driven; … A genuinely different second tileset (v9) needs decor
data too — out of scope, flagged so the abstraction's current limit is
explicit." It was now hitting the user.

## A design conversation, not a spec

Before writing v10, the user offered a much richer mental model than the
v8 schema had: categories (empty / filled / pickup / exit / hazard /
decoration), multiple variants within each category, state-changing exit
(swap art when all pickups collected), and the observation that some
tilesets ship 16 edge-mask tiles for autotiling while others only ship
one block — *two ways of declaring tiles*. I reflected that analysis back
as three independent axes (category / variant / autotile-shape), affirmed
the parts that fit cleanly, and pushed back where I thought a richer
schema was being asked to do work the renderer should do.

The user picked "Phase 1": fix the visible bug, defer the richer schema
to v11. Phase 1's stance: this is a **renderer + loader** change. No data
migration, no JSON schema "rename" with breaking edits, no Dirt
disruption. The richer category model lives in the v10 design's §11
roadmap, ready to come back to as v11+.

## The pivotal observation

The four shipped non-Dirt `tile_lookup.json` files already declared
`glyphs[*].image` URLs for legend thumbnails. The renderer ignored them.
If the renderer's "no atlas" fallback chain ended at `glyphs.filled.image`
for the terrain pass, and consulted `glyphs[<role>].image` for entities,
**all four tilesets would render distinctly without touching a single
data file.** That observation collapsed the implementation surface to:

- `tileset.js` exposes two new accessors `terrainFor(mask)` and
  `entityFor(char)` that walk the fallback chain.
- `renderer.js` lifts the `ready` gate and asks the lookup per-cell.

Done.

## Build

- **M1 — loader (pure).** Extend `loadTileset` to parse a new optional
  `lookup.terrain.{default,masks}` namespace and alias legacy
  `lookup.filled` onto `terrain.masks` so Dirt's JSON stays
  byte-untouched. Preload entity images keyed by char from
  `lookup.glyphs`. Expose `atlasReady` (renamed from `ready`, alias
  kept), `terrainFor(mask)` (resolves `masks[m] → default → glyphs.
  filled.image → null`), `entityFor(char)` (resolves
  `glyphs[role-by-char].image → null`). `loadTileset(id, opts?)` gains
  injectable `fetch` + `loadImage` for tests, matching `levels.js`'s
  DI pattern. **10 new `node --test` cases**, suite 73 → 83. No
  behaviour change in the app yet.

- **M2 — renderer.** Drop the `if (ready)` gate that wrapped Pass 1–3.
  Each pass now asks per-cell:
  - Pass 1 still atlas-only (Dirt sky/cave background blit).
  - Pass 2: `terrainFor(mask)` → image, else shape fallback. Dirt's
    route returns the same Image instance for the same mask as before
    → byte-identical render proven by the renderer suite + the
    unchanged Dirt md5 (`5172269f…`).
  - Pass 3: decor pass unchanged, still `atlasReady`-only — v8 decor
    limit preserved as declared, not a regression.
  - Pass 4: `entityFor(char)` → image, else shape fallback. Dirt's
    entity glyphs declare `image: null` so this routes to the shape
    path it already used.
  Renderer test extended with three v10 cases — atlas-less terrain
  image, atlas-less entity image, terrain null → shape. Suite 83 → 86.

- **M3 — Playwright distinctness gate.** Capture-then-assert: after the
  existing capture test loops over every manifest tileset and writes
  preview/legend/pane PNGs, a second test md5-hashes every preview and
  asserts pairwise distinctness with a message that lists *all*
  colliding pairs (not just the first). Before v10 this test would have
  failed loudly; after v10 it's green.

  Spot hashes after M2:

  | Tileset | Preview md5 |
  |---|---|
  | Dirt_Platformer_Tiles | `5172269f…` (unchanged from before v10) |
  | 2D Circle Graphic | `eaee75b9…` |
  | Pixel Adventure 1 | `b1d290f0…` |
  | PlayWithYourPeas | `cc816f5f…` |
  | Treasure Hunters | `368516be…` |

- **M4 — docs + transcript.** This file; design + implementation
  marked Delivered with hashes.

## What stayed out (the explicit non-goals)

- **Sprite-frame cropping** for animation sheets. Pixel Adventure 1's
  Mask Dude PNG is 352×32 (11 frames); drawn at TILE size it squashes
  into a horizontal strip — distinct per tileset (the bug is fixed) but
  ugly. PlayWithYourPeas and Treasure Hunters render cleanly because
  their authored frames are single-frame. This is the right next thing
  to land in v11.
- **Procedural decor for non-Dirt tilesets.** Grass/moon/stars/drips
  remain Dirt-atlas-bound. v11 will lift those rules into
  `lookup.decor` so other packs can author their own.
- **State-changing exit** (`imageActive`), **decoration category**,
  **multi-glyph variants in a category**, **convention-based autotile
  discovery**. All compose cleanly on v10's foundation — design §11
  enumerates them as v11+ candidates.

## The standing gap (unchanged from v9)

No automated DOM/canvas test for the editor's rendering pipeline beyond
the Playwright harness — same as the v2 standing gap. The pure parts
(loader, parser, validator, gate) are all `node --test`-ed. The
Playwright harness now both *documents* the v10 fix (screenshots,
checked-in spec) and *guards against regression* (the distinctness
assertion).
