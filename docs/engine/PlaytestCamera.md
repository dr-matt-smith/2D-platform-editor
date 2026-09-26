# PlaytestCamera

`packages/engine/src/PlaytestCamera.ts` · class

The scrolling camera of a playtest whose level sets `# viewport:`. It shows a
viewport-sized window of the world and follows the player with a *dead
zone*: a box in the middle of the view inside which the player moves without
the camera moving.

## Relationships
- owned by [PlaytestScene](PlaytestScene.md) (only for `# viewport:` levels)
- sizes are [Size](Size.md)s, targets are [Point](Point.md)s; position is a [CameraOrigin](CameraOrigin.md); dead zone is a [DeadZone](DeadZone.md)
- `view` is the render package's `CameraWindow`, passed to `LevelRenderer.draw`

## Members
| Member | Kind | Description |
|---|---|---|
| `DEFAULT_DEAD_ZONE` | static readonly | `{ w: 0.4, h: 0.33 }` of the viewport |
| `new PlaytestCamera(viewport, world, deadZone?)` | constructor | Starts at (0, 0) |
| `viewport`, `world` | readonly properties | Sizes in world pixels |
| `x`, `y` | get accessors | The view's top-left corner |
| `origin` | get accessor | `{ camX, camY }` |
| `view` | get accessor | `{ camX, camY, viewW, viewH }` for the renderer |
| `moveTo(origin)` | method | Jump to a position (clamped) |
| `centreOn(target)` | method | Centre the view on `target` (clamped) |
| `follow(target)` | method | One frame of dead-zone following (clamped) |

When the target crosses a dead-zone edge, the camera moves by exactly the
overshoot, so the target ends up on that edge. Every position is clamped to
`[0, world − viewport]` per axis — or `0` where the world is smaller than
the view.

## Example
```ts
const camera = new PlaytestCamera({ w: 400, h: 240 }, { w: 800, h: 320 });
camera.centreOn({ x: 400, y: 160 });
camera.origin;                       // { camX: 200, camY: 40 }
camera.follow({ x: 500, y: 160 });   // 20 px past the right dead-zone edge
camera.x;                            // 220
```

## Design notes
- **State and behaviour together.** The camera's position used to live in
  the scene with the maths in free functions; now the object that owns the
  position is the only thing that can change it, and it always keeps it
  inside the world (an invariant enforced in one private method).
- **Arithmetic unchanged.** `follow` performs the same operations in the
  same order as before, so camera positions — and the e2e screenshots that
  depend on them — are identical.
