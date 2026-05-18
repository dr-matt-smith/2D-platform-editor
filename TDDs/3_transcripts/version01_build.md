# Transcript — Version 1: Scaffold, Design, Build

A narrative record of the v1 phase: how the project went from an empty folder
to a working text-first level editor. Decisions and rationale, in order.

## Project setup

The repo began as a bare folder with the tileset asset and the ideas doc
([version00_ideas.md](version00_ideas.md)). It was made a Node project, then
converted to **Vite** (vanilla JS, ESM) so it runs with `npm run dev`. Git was
initialised locally (no remote, by request). `.claude/settings.local.json`
slipped into the first commit and was untracked immediately; `node_modules/`
and `dist/` were gitignored.

A deliberate stack choice: **vanilla JS, no framework**. The editor is small
and DOM-light; a framework would have been premature. This was flagged to the
user as reversible before real code existed.

## Design

The v1 design doc was written from the ideas doc's own prioritisation — the
five highest-leverage features (monospace + guides, live preview, rectangle
fill, validation, fast play-test). The user then **dropped rectangle fill**,
so the doc was scrubbed of every dependent reference (scope, UI palette,
milestones, undo notes, acceptance) to stay internally consistent. A ranked
**v2 candidates** backlog was added so deferred scope had a home; layers /
multi-char cells / entity properties were deliberately kept *out* of even the
v2 list because they change the format and parser.

Key honest gap recorded in the design: v1 has no game runtime, so the
"fast play-test" feature could only ever be partially served — flagged in §8
rather than glossed over.

## Implementation

Built in five milestones, each its own commit, each keeping `npm test` green:

1. **`level.js`** — parse/serialize. The subtle part was distinguishing a
   header directive from a wall row; solved with a `# key: value` regex so
   `####` is never a directive. Round-trip tested.
2. **`tileset.js` + `renderer.js`** — renderer kept pure (no DOM reads) so it
   is unit-testable with a fake canvas context. Tileset loader degrades to a
   coloured-shape fallback if the image fails.
3–5. **`validate.js` + `main.js`** — validation with line/col; the UI debounce
   loop, ruler/gutter alignment via a canvas-measured char width, cursor
   readout, localStorage, and a clickable problems panel.

A test runner (`node:test`, zero dependencies) was added even though the
design only implied tests — chosen to avoid pulling in a framework.

## Outcome

14 tests green, clean build, dev server verified serving the app, the tileset
asset, and transformed modules. v1 acceptance criteria met. The one open
caveat carried forward: the preview renders one tile per `#` with no
decoration — faithful screenshot-style rendering was explicitly left for v2.
