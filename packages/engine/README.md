# `@2d-platform/engine` — the game engine

The playable game: the loop, input, physics, entities, the playtest scene
and camera, and `launchPlaytest()` to mount a level on a canvas (used by
the editor's Play mode and by the player app). `jsAdapter` implements the
agent's `PhysicsAdapter`, so the planner can simulate this exact engine.
Public API: [`src/index.ts`](src/index.ts). Architecture:
[README_architecture.md](../../README_architecture.md).

## Vendored engine

The core mechanic is **not authored here**. It
is vendored from
[`dr-matt-smith/simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
at pinned commit **`4c3b936`** ("Rename project to drop kaplay/Bean
association"), licensed **CC BY 4.0** (see [`./LICENSE`](./LICENSE) and
[`./sources.md`](./sources.md)). See `TDDs/1_design/version09_design.md`
for the initial vendor design and `TDDs/1_design/version15_design.md`
for the v15 cleanup that moved the licence text here from
`public/play-assets/`.

`src/core/`, `src/entities/{player,platform,coin,spike}.ts` and `src/constants.ts` are
**byte-identical to upstream@4c3b936** except the four deliberate forks
below (design §7). Keep it that way so a re-sync is a known small diff.

| File | Fork vs upstream |
|------|------------------|
| `logger.ts` | replaced with a **no-op shim** so vendored files import it unchanged but nothing writes to the author's `localStorage` |
| `core/game.ts` | `stop()` + a `running` flag (loop teardown); clears the canvas at its real size, not fixed `CANVAS_W/H` (drops that import) |
| `core/input.ts` | `dispose()` removes the `window` key listeners (repeated open/close must not stack handlers); a `blur` listener releases held keys when the window loses focus (their keyup is never seen, so the player would keep running) |

`entities/goal.ts` is **v9-original** (the `E` exit; upstream had no exit).
`adapter.ts`, `playtestGate.ts`, `playtestScene.ts`, `launcher.ts` are
v9-original glue (not vendored).
