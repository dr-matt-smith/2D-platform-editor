# CameraWindow

`packages/render/src/CameraWindow.ts` · interface

The part of the world a scrolling camera shows, in world pixels: its
top-left corner `(camX, camY)` and the view size.

## Relationships
- the `camera` of [DrawOptions](DrawOptions.md)
- turned into a [CellRange](CellRange.md) by `CellRange.visible`
- built each frame by the engine's `PlaytestScene` from its camera and viewport

## Members
| Member | Kind | Description |
|---|---|---|
| `camX`, `camY` | property | Top-left of the view in world pixels (may be fractional; the renderer rounds) |
| `viewW`, `viewH` | property | View size in pixels |

## Example
```ts
renderer.draw(ctx, level, { camera: { camX: 120.5, camY: 0, viewW: 480, viewH: 320 } });
```

## Design notes
A plain data interface: the engine owns the camera's behaviour (following
the player); the renderer only needs to know where it is looking.
