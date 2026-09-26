# Player app

Play the bundled levels full-window, served at `/apps/player/`
(`deno task dev`). Link straight to a level with `?level=<id>`, e.g.
`/apps/player/?level=tutorial`.

Controls: ←/→ move · Space jump · R restart · Esc stop (then Enter to play again).

## Code layout

`src/main.ts` is the composition root: it finds the page's elements, builds
the objects below and starts `PlayerApp`. Each class is in a file of the
same name in `src/`.

| Class | Role |
|---|---|
| `PlayerApp` | The app: page state (`body[data-state]`), level choice, keyboard, play |
| `PlayerView` | The page's elements, wrapped in `LevelPicker` and `MessagePanel` |
| `LevelPicker` | The level `<select>`, with an `<optgroup>` per group |
| `MessagePanel` | The message over the stage; readable launch-gate reasons |
| `LevelUrl` | Reads and keeps `?level=<id>` in the address bar |
| `LevelCatalog` | The level list from `content/data/levels/manifest.json`, and each level's text |
| `PlaySession` | Loads a level, its tileset and legend, and launches it on the canvas (one run at a time) |
| `TilesetCache` | Each tileset and its legend, loaded once |
| `PageState`, `StartStatus` | Enums: what the page is doing; how starting a level went |

Unit tests sit beside the classes (`*.test.ts`, `deno task test`);
Playwright specs are in `e2e/` (`deno task test:e2e apps/player`).

Class-by-class documentation, with a class diagram, is in
[docs/player](../../docs/player/README.md).

Uses `level-format`, `render` and `engine` only — see
[README_architecture.md](../../README_architecture.md).
