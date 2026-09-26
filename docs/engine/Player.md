# Player

`packages/engine/src/Player.ts` · class

The player: a box with velocity, gravity and a single jump. Its `update` is
the heart of the physics — and the part the Python port is checked against,
frame for frame.

## Relationships
- extends [Entity](Entity.md), overriding `update` and implementing `draw`
- reads keys from the [InputSource](InputSource.md) and collides with the [Box](Box.md)es in its [UpdateContext](UpdateContext.md)
- resolves collisions with [Aabb](Aabb.md)`.resolveAxis`; reads [Key](Key.md)s
- `setState` takes a [PlayerStateOverride](PlayerStateOverride.md)
- built by [World](World.md); driven by [PlaytestScene](PlaytestScene.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `new Player(x, y)` | constructor | A tile-sized player at rest, not on the ground |
| `vx`, `vy` | properties | Velocity in pixels per second (y grows downwards) |
| `onGround` | property | Standing on a platform? Only then can it jump |
| `update(dt, { input, solids })` | method | One frame of physics (below) |
| `setState(state)` | method | Force position and velocity; missing velocity/ground default to a standing start |
| `draw(ctx)` | method | A filled square |

`update` runs these steps, in this order:

| # | Step | Private method |
|---|---|---|
| 1 | Run speed from left/right; jump (space or up) if on the ground | `steer` |
| 2 | `vy += GRAVITY * dt` | — |
| 3 | Move along x, then push out of any solid now overlapped | `moveX` |
| 4 | Move along y with a swept test: land on a top, or bump a ceiling | `moveY` |

## Example
```ts
const player = new Player(20, 20);
const input = new ScriptedInput([{ frame: 0, key: Key.Right, down: true }]);
input.advance(0);
player.update(1 / 60, { input, solids: world.platforms });
player.x; // 24 — SPEED (240) × 1/60 s
```

## Design notes
- **Overriding.** `Player` is the only entity that replaces the base
  class's do-nothing `update`.
- **One public method, private steps.** `update` reads as the four steps;
  each is a small private method. The statements inside are exactly those
  of the vendored original, in the same order — floating-point results
  depend on the order of operations, and golden vectors check them.
- **Swept vertical test.** A fast fall covers up to ~38 px a frame, more
  than a thin platform is tall. Testing whether the feet *crossed* a top
  between the old and new y, rather than whether they overlap at the end,
  cannot tunnel.
- **Dependencies as a parameter.** The player is given its input and solids
  each frame (an [UpdateContext](UpdateContext.md)) instead of reaching into
  a scene, so a test can drive it with a recording and a list of boxes.
- **Public state by contract.** `x`, `y`, `vx`, `vy` and `onGround` stay
  public because the agent's `PhysicsAdapter` contract reads them every
  frame and sets them to start a simulation.
