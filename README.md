# 2D Platform Editor

**Live:** https://dr-matt-smith.github.io/2D-platform-editor/ (editor at
[`/apps/editor/`](https://dr-matt-smith.github.io/2D-platform-editor/apps/editor/),
player at [`/apps/player/`](https://dr-matt-smith.github.io/2D-platform-editor/apps/player/)) ·
**GitHub:** https://github.com/dr-matt-smith/2D-platform-editor

A text-based level editor for simple 2D platformer / maze games. Author
levels as ASCII grids in a textarea with live tile-mapped preview, then
**playtest them in the browser** with a real physics engine — no export,
no leaving the page.

## Quick start

Needs [Deno](https://deno.com) 2.x — there is no install step: Deno fetches
Vite and the other tools on first run.

```bash
deno task dev              # http://localhost:5173 — editor at /apps/editor/, player at /apps/player/
deno task solve tutorial   # run the agent headless on a level (--all sweeps every level)
deno task test             # unit tests (Deno.test)
deno task check            # layering check + type check the whole project
deno task build            # production site (landing page, editor, player) in dist/
deno task test:e2e         # Playwright end-to-end tests (starts the dev server itself)
```

The first `deno task test:e2e` needs Playwright's browser:
`deno run -A npm:@playwright/test install chromium`.

`deno task gen` regenerates the levels and tilesets manifests; `dev` and
`build` run it automatically first. All tasks are defined in `deno.json`.

## Editor

- ASCII grid with header directives (`# name:`, `# size: WxH`,
  `# tileset:`, `# theme:`) and `//` line comments.
- Live canvas preview with autotiled terrain (4-neighbour mask) and
  per-tileset decor (sky / cave themes).
- Tileset-derived **legend** with thumbnails — click to set the active
  glyph; drag on the preview to fill a rectangle (Shift = hollow outline).
- Problems panel with click-to-jump (line/col), undo/redo, drafts per
  level in `localStorage`, levels dialog, downloadable `.txt`.

### Level format

```
# name: tutorial-01
# size: 24x10
# tileset: Dirt_Platformer_Tiles
########################
#......................#
#...P.............E....#
…
```

Glyphs (names come from the active tileset's `tile_lookup.json`):
`.` empty · `#` filled · `P` spawn (exactly one) · `E` exit · `^` hazard
· `o` pickup.

## Playtest (v9)

Press **Play** (or **Ctrl/Cmd+Enter**) to play the *current buffer* —
unsaved edits included — with the mechanic vendored from
[`simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
(@4c3b936, CC BY 4.0). Win: collect every `o` then touch an `E`. Lose:
touch a `^` or fall off the world. `R` restarts, `Esc` exits.

The launch gate is **stricter than the editor lint**: a missing `E` is a
hard block (the win is otherwise unreachable), reported in the problems
panel instead of opening the overlay. Arbitrary level sizes play
scale-to-fit (no camera).

## Project layout

The project is split into four library packages and three apps — see
[README_architecture.md](README_architecture.md) for the diagram, the
dependency rules and the contracts between the parts.

```
packages/level-format/  the level text format: parse, legends, validate
packages/render/        tilesets + canvas renderer
packages/engine/        the game: physics, entities, playtest (vendored engine,
                        CC BY 4.0; LICENSE + sources.md alongside the code)
packages/agent/         the planning agent (A* over simulated physics)
packages/agent-py/      Python port of the physics + planner (+ MCP server)
apps/editor/            the level editor (browser)
apps/player/            standalone player (browser)
apps/agent-cli/         headless solver: deno task solve
content/data/           bundled levels and tilesets (+ generated manifests)
scripts/                manifest generators + the layering check
TDDs/                   per-version Design / Implementation / Transcript docs
```

## Versioning model

Each version ships as a TDD trio under `TDDs/`:
`1_design/versionNN_design.md` → `2_implementation/versionNN_implementation.md`
→ `3_transcripts/versionNN_build.md`, one path-scoped commit per
milestone.

## Licence

The editor itself is **MIT**. The vendored playtest
engine under `packages/engine/` is **CC BY 4.0** (full text in
[`packages/engine/LICENSE`](packages/engine/LICENSE); attribution in
[`packages/engine/sources.md`](packages/engine/sources.md)). Earlier versions also
vendored three CC BY 4.0 PNG sprites under `public/play-assets/`;
v14 made the editor renderer the single source of pixel truth for
playtest, and v15 removed the sprites + moved the licence text in beside
the engine code (then `src/play/`, now `packages/engine/`).
