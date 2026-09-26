# CameraOrigin

`packages/engine/src/PlaytestCamera.ts` · interface

A camera position: the top-left corner of the view, in world pixels.

## Relationships
- returned by [PlaytestCamera](PlaytestCamera.md)`.origin`; taken by `moveTo`

## Members
| Member | Kind | Description |
|---|---|---|
| `camX`, `camY` | properties | The corner |

## Example
```ts
camera.moveTo({ camX: 120, camY: 30 });
```

## Design notes
The field names match the render package's `CameraWindow`, which adds the
view size.
