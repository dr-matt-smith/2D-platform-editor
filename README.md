# 2D Platform Editor

**Live:** https://dr-matt-smith.github.io/2D-platform-editor/ ·
**GitHub:** https://github.com/dr-matt-smith/2D-platform-editor

A text-based level editor for simple 2D platformer / maze games. Author
levels as ASCII grids in a textarea with live tile-mapped preview, then
**playtest them in the browser** with a real physics engine — no export,
no leaving the page.

## Quick start

Needs [Deno](https://deno.com) 2.x — there is no install step: Deno fetches
Vite and the other tools on first run.

```bash
deno task dev       # editor at http://localhost:5173
deno task test      # unit tests (Deno.test)
deno task check     # type check the whole project
deno task build     # production bundle in dist/
deno task test:e2e  # Playwright end-to-end tests (starts the dev server itself)
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

```
src/              editor, in TypeScript (parse, validate, renderer, levels, history, …)
src/play/         vendored playtest engine + adapter + gate + scene
                  (CC BY 4.0; LICENSE + sources.md alongside the code)
public/data/      bundled levels and tilesets (+ generated manifests)
TDDs/             per-version Design / Implementation / Transcript docs
packages/agent/   the planning agent (Deno workspace member @2d-platform/agent)
packages/agent-py/ Python port of the physics adapter + planner (+ MCP server)
tests/            Playwright end-to-end specs
scripts/          manifest generators (run before dev/build)
```

## Versioning model

Each version ships as a TDD trio under `TDDs/`:
`1_design/versionNN_design.md` → `2_implementation/versionNN_implementation.md`
→ `3_transcripts/versionNN_build.md`, one path-scoped commit per
milestone.

## Licence

The editor itself is **MIT**. The vendored playtest
engine under `src/play/` is **CC BY 4.0** (full text in
[`src/play/LICENSE`](src/play/LICENSE); attribution in
[`src/play/sources.md`](src/play/sources.md)). Earlier versions also
vendored three CC BY 4.0 PNG sprites under `public/play-assets/`;
v14 made the editor renderer the single source of pixel truth for
playtest, and v15 removed the sprites + moved the licence text into
`src/play/` where the engine code lives.
