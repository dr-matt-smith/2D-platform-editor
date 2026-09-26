# `@2d-platform/level-format` — the level text format

What a level *is*, independent of how it is drawn or played:

- **`level.ts`** — `parse()` / `serialize()` for the ASCII format (header
  directives such as `# name:`, `# tileset:`, `# viewport:`,
  `# pickup-required:`, `//` comments, then the grid), the glyph **legend**
  and each glyph's **role** (`player`, `exit`, `hazard`, `pickup`, …), and
  helpers that rewrite directives or fill rectangles of the grid.
- **`validate.ts`** — problems with a level (no or extra player spawn, no exit,
  undefined glyphs, grid vs declared size) as `{ line, col, severity, message }`.
- **`playSettings.ts`** — the pickup-requirement rule shared by the editor's
  Play Settings dialog and the engine's win check.

Pure logic: no DOM and no I/O, so it runs anywhere (browser, Deno CLI, tests).
Every other package builds on it. Public API: [`src/index.ts`](src/index.ts).
See [README_architecture.md](../../README_architecture.md).
