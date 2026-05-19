# `src/play/` — vendored playtest engine

The mechanic for the editor's **Playtest** mode is **not authored here**. It
is vendored from
[`dr-matt-smith/simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
at pinned commit **`4c3b936`** ("Rename project to drop kaplay/Bean
association"), licensed **CC BY 4.0** (see `../../public/play-assets/LICENSE`
and `sources.md`). See `TDDs/1_design/version09_design.md`.

`core/`, `entities/{player,platform,coin,spike}.js` and `constants.js` are
**byte-identical to upstream@4c3b936** except the four deliberate forks
below (design §7). Keep it that way so a re-sync is a known small diff.

| File | Fork vs upstream |
|------|------------------|
| `logger.js` | replaced with a **no-op shim** so vendored files import it unchanged but nothing writes to the author's `localStorage` |
| `core/game.js` | `stop()` + a `running` flag (loop teardown); clears the canvas at its real size, not fixed `CANVAS_W/H` (drops that import) |
| `core/input.js` | `dispose()` removes the `window` key listeners (repeated open/close must not stack handlers) |

`entities/goal.js` is **v9-original** (the `E` exit; upstream had no exit).
`adapter.js`, `playtestGate.js`, `playtestScene.js`, `launcher.js` are
v9-original glue (not vendored).
