# Size

`packages/engine/src/Size.ts` · interface

A width and height in world pixels.

## Relationships
- returned by [World](World.md)`.size`
- the viewport and world of a [PlaytestCamera](PlaytestCamera.md)

## Members
| Member | Kind | Description |
|---|---|---|
| `w`, `h` | properties | Width and height |

## Example
```ts
new PlaytestCamera({ w: 400, h: 240 }, world.size);
```

## Design notes
Same shape as level-format's `Dimensions`, but in pixels rather than cells;
a separate name keeps the unit clear.
