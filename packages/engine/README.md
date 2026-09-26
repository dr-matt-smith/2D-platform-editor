# `@2d-platform/engine` — the game engine

How a level *plays*:

- **[`Playtest`](../../docs/engine/Playtest.md)** —
  `Playtest.launch(level, legend, tileset, canvas, options?)` checks the
  level ([`PlaytestGate`](../../docs/engine/PlaytestGate.md)), sizes the
  canvas, and runs it; the returned playtest has `restart()`, `exit()`,
  `onExit()` and `phase`. One playtest runs at a time. Used by the editor's
  Play mode and by the player app.
- **[`PlaytestScene`](../../docs/engine/PlaytestScene.md)** — the rules:
  collect pickups, reach the exit, avoid hazards; HUD, banner, restart, and
  a dead-zone [`PlaytestCamera`](../../docs/engine/PlaytestCamera.md) for
  `# viewport:` levels. Hosted by the [`Game`](../../docs/engine/Game.md)
  loop in the browser, or run headless.
- **[`Entity`](../../docs/engine/Entity.md)** and its subclasses
  [`Player`](../../docs/engine/Player.md) (the physics),
  [`Platform`](../../docs/engine/Platform.md),
  [`Coin`](../../docs/engine/Coin.md), [`Spike`](../../docs/engine/Spike.md)
  and [`Goal`](../../docs/engine/Goal.md), built from a level by
  [`World.fromLevel`](../../docs/engine/World.md).
- **[`InputSource`](../../docs/engine/InputSource.md)** — implemented by
  [`KeyboardInput`](../../docs/engine/KeyboardInput.md) and
  [`ScriptedInput`](../../docs/engine/ScriptedInput.md) (recorded
  playback, for Demo mode and the agent).
- **[`JsPhysicsAdapter`](../../docs/engine/JsPhysicsAdapter.md)** — the
  engine as the agent's `PhysicsAdapter`; pass the shared `jsAdapter` to
  the planner so it simulates this exact engine.

Depends on `level-format`, `render`, and the `agent` package's
`PhysicsAdapter` type (type-only). Public API: [`src/index.ts`](src/index.ts).
Class diagram and one page per class, interface and enum:
[docs/engine](../../docs/engine/README.md). See also
[README_architecture.md](../../README_architecture.md).

## Adapted from simple-platformer-1 (CC BY 4.0)

The core mechanic is **not original to this project**. It was vendored from
[`dr-matt-smith/simple-platformer-1`](https://github.com/dr-matt-smith/simple-platformer-1)
at commit **`4c3b936`** ("Rename project to drop kaplay/Bean association"),
© 2026 Matt Smith, licensed **CC BY 4.0** (full text in [`./LICENSE`](./LICENSE);
attribution details in [`./sources.md`](./sources.md)).

The vendored code has since been **adapted and restructured**; it is no
longer identical to upstream:

| Vendored file (before) | Now | What changed |
|---|---|---|
| `src/core/game.ts` | `Game.ts` | Private state; `stop()` ends the loop; the canvas is cleared at its real size; `frameDt` (now `Game.frameDt`) never returns a negative step. Implements `SceneHost` |
| `src/core/scene.ts` | `Scene.ts` | Abstract class; `update` / `draw` are abstract; holds a `SceneHost` rather than a `Game` |
| `src/core/input.ts` | `KeyboardInput.ts` | Implements `InputSource`; created by `KeyboardInput.attach()`; `dispose()` removes the window listeners; losing focus releases held keys; key names are the `Key` enum |
| `src/core/aabb.ts` | `Aabb.ts`, `Box.ts`, `Axis.ts` | Static methods on an `Aabb` class; the `Rect` shape is now the `Box` interface |
| `src/core/assets.ts` | `SoundBank.ts` | Only the synthesised sounds remain (sprite and level loading dropped); `prewarm()` added; sounds are the `Sound` enum |
| `src/entities/{player,platform,coin,spike}.ts` | `Entity.ts`, `Player.ts`, `Platform.ts`, `Coin.ts`, `Spike.ts` | A shared abstract `Entity` base; the player's update is split into private steps and takes an `UpdateContext`; sprite drawing replaced by simple shapes (the playtest draws through the render package); `PlatformKind` enum |
| `src/logger.ts` | — | Removed (it had been reduced to a no-op shim) |
| `src/constants.ts` | `constants.ts` | Values unchanged; a header comment added |

**The physics arithmetic is unchanged** — the same operations in the same
order — and the Python port's golden vectors (`deno task gen:golden`) prove
it frame for frame.

Everything else — `Goal`, `World`, the playtest scene, gate, camera,
launcher, `ScriptedInput` and `JsPhysicsAdapter` — is original to this
project.
