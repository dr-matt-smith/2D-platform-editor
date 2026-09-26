# `@2d-platform/level-format` — the level text format

What a level *is*, independent of how it is drawn or played:

- **[`Level`](../../docs/level-format/Level.md)** — a parsed level.
  `Level.parse(text)` reads the ASCII format (header directives such as
  `# name:`, `# tileset:`, `# viewport:`, `# pickup-required:`, `//`
  comments, then the grid); `serialize()` writes it back. Queries such as
  `cellAt`, `findCells(role)` and `validate()`.
- **[`LevelText`](../../docs/level-format/LevelText.md)** — the raw text,
  with setters (`setTileset`, `setBackgroundImage`, `setViewport`,
  `setPickupRequired`) that change one directive and keep the author's
  formatting.
- **[`Legend`](../../docs/level-format/Legend.md)** — a tileset's glyphs and
  each one's **[`Role`](../../docs/level-format/Role.md)** (`Player`, `Exit`,
  `Hazard`, `Pickup`, …): `Legend.fromLookup(tile_lookup)` or `Legend.DEFAULT`.
- **[`LevelValidator`](../../docs/level-format/LevelValidator.md)** — problems
  with a level (no or extra player spawn, no exit, undefined glyphs, grid vs
  declared size) as `ValidationIssue`s with a
  [`Severity`](../../docs/level-format/Severity.md).
- **[`PickupRequirement`](../../docs/level-format/PickupRequirement.md)** —
  the pickup rule shared by the editor's Play Settings dialog and the
  engine's win check.
- **[`Rect`](../../docs/level-format/Rect.md)** — the editor's fill and
  outline tools.

Pure logic: no DOM and no I/O, so it runs anywhere (browser, Deno CLI, tests).
Every other package builds on it. Public API: [`src/index.ts`](src/index.ts).
Class diagram and one page per class, interface and enum:
[docs/level-format](../../docs/level-format/README.md). See also
[README_architecture.md](../../README_architecture.md).
