# DeadZone

`packages/engine/src/PlaytestCamera.ts` · interface

The size of a [PlaytestCamera](PlaytestCamera.md)'s dead zone, as fractions
(0..1) of the viewport.

## Relationships
- optional third argument of [PlaytestCamera](PlaytestCamera.md)'s constructor (as a `Partial`)

## Members
| Member | Kind | Description |
|---|---|---|
| `w` | property | Width fraction (default `0.4`) |
| `h` | property | Height fraction (default `0.33`) |

## Example
```ts
new PlaytestCamera(viewport, world, { w: 0.2 }); // narrower, default height
```

## Design notes
Taking a `Partial<DeadZone>` lets a caller override one fraction and keep
the other's default.
