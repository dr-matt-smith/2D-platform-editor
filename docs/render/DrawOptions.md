# DrawOptions

`packages/render/src/DrawOptions.ts` · interface

Per-frame settings for [LevelRenderer](LevelRenderer.md)`.draw`. All
optional: the editor preview passes none and gets a still picture of the
whole level.

## Relationships
- taken by [LevelRenderer](LevelRenderer.md)`.draw`
- holds a [CameraWindow](CameraWindow.md) and an [EntityState](EntityState.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `now` | optional property | Time in ms for animated sprites; omitted → frame 0 |
| `camera` | optional property | [CameraWindow](CameraWindow.md) \| `null` — draw only this view, on a canvas its size |
| `entityState` | optional property | [EntityState](EntityState.md) \| `null` — e.g. show the exit locked |

## Example
```ts
renderer.draw(ctx, level, { now: performance.now(), camera: null, entityState: { exitLocked } });
```

## Design notes
A **parameter object**: named, optional settings instead of positional
arguments, so a call site says what it sets and can leave the rest out.
