# Player app

Play the bundled levels full-window, served at `/apps/player/`
(`deno task dev`). Link straight to a level with `?level=<id>`, e.g.
`/apps/player/?level=tutorial`.

Controls: ←/→ move · Space jump · R restart · Esc stop (then Enter to play again).

- `src/main.ts` — wires the page: level picker, URL, keyboard, and the page state (`body[data-state]`)
- `src/session.ts` — `PlaySession`: load a level, its tileset and legend, and launch it on the canvas (one run at a time)
- `src/catalog.ts` — the level list from `content/data/levels/manifest.json`
- `src/issues.ts` — readable messages for levels that fail the launch gate
- `e2e/` — Playwright specs

Uses `level-format`, `render` and `engine` only — see
[README_architecture.md](../../README_architecture.md).
