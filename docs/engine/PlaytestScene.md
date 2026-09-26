# PlaytestScene

`packages/engine/src/PlaytestScene.ts` · class

The one scene of a playtest: a single level, played until it is won or lost.
Collect enough pickups, then touch an exit to win; touch a hazard or fall
out of the world and it is game over. R restarts.

## Relationships
- extends [Scene](Scene.md)
- rebuilds a [World](World.md) on every restart and drives its [Player](Player.md)
- has a [PlaytestCamera](PlaytestCamera.md) when the level sets `# viewport:`
- draws with the render package's `LevelRenderer`; checks level-format's `PickupRequirement`
- reports a [GamePhase](GamePhase.md); plays [Sound](Sound.md)`.Coin` through its host's [SoundPlayer](SoundPlayer.md)
- ticks a scripted [InputSource](InputSource.md) (one with `advance`) before the player reads it
- created by [Playtest](Playtest.md) (live) and [JsPhysicsAdapter](JsPhysicsAdapter.md) (headless); satisfies the agent's `SceneHandle` contract

## Members
| Member | Kind | Description |
|---|---|---|
| `buildViewGrid(grid, cleared)` | static method | A copy of `grid` with the listed cells (level-format `GridPosition`s) set to `'.'` |
| `new PlaytestScene(game, level, legend, tileset)` | constructor | `tileset` may be `null` (fallback shapes) |
| `phase` | property | The [GamePhase](GamePhase.md) |
| `score` | property | Pickups collected so far |
| `simFrame`, `simTime` | properties | The scripted-input clock: next recording frame, and seconds played |
| `player` | get accessor | The [Player](Player.md) |
| `coins` | get accessor | The [Coin](Coin.md)s |
| `total` | get accessor | How many pickups the level has |
| `enter()` | method | Calls `restart()` |
| `restart()` | method | Fresh world, score 0, phase `Play`, camera on the player, spawn settle, clock rewound |
| `setPlayerState(state)` | method | Force the player's pose ([PlayerStateOverride](PlayerStateOverride.md)); used by the agent |
| `update(dt)` | method | One frame (below) |
| `draw(ctx)` | method | Level (spawn and collected pickups hidden), moving player, HUD band, and the win / game-over banner |

`update(dt)`, in this order — the order is part of the physics contract:

| # | Step |
|---|---|
| 1 | Tick scripted input to frame `floor(simTime × 60)` |
| 2 | Not playing? R restarts; stop here |
| 3 | `player.update(dt, …)` |
| 4 | Collect every overlapped coin (score, sound) |
| 5 | Overlapping a spike → `Dead` |
| 6 | More than 50 px below the world → `Dead` |
| 7 | Pickup rule met and overlapping a goal → `Won` |
| 8 | Camera follows the player |
| 9 | R restarts |

## Example
```ts
// Headless, as the agent runs it.
const host: SceneHost = { input: new ScriptedInput(recording), sounds: { play() {} } };
const scene = new PlaytestScene(host, level, Legend.DEFAULT, null);
scene.enter();
while (scene.phase === GamePhase.Play) scene.update(1 / 60);
```

## Design notes
- **Subclass of a template.** It fills in [Scene](Scene.md)'s hooks; the
  [Game](Game.md) loop is unchanged.
- **One class, two uses.** The same scene runs in the browser and inside
  the agent's planner, because it depends only on a
  [SceneHost](SceneHost.md) and an [InputSource](InputSource.md). What the
  agent plans is exactly what the player sees.
- **Public state by contract.** `phase`, `score`, `simFrame`, `simTime`,
  `player` and `coins` are public because the agent's `PhysicsAdapter`
  contract reads and resets them; everything else (world, camera, renderer,
  pickup rule) is `private`.
- **Spawn settle.** `restart()` lets the player fall with no keys held (at
  most 30 frames) before the input clock starts, so a recording's first key
  lands when the player is already standing — as the planner assumed.
- **Scripted input follows play time.** The recording advances to frame
  `floor(simTime × 60)`, not one frame per browser tick, so a 120 Hz screen
  replays a 60 fps plan at the right speed.
- **Composition.** Camera, renderer and world are held collaborators, not
  base classes: a playtest scene *has a* camera, it is not one.
