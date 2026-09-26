# Platform

`packages/engine/src/Platform.ts` · class

A solid rectangle the player cannot pass through. Every terrain cell of a
level becomes one.

## Relationships
- extends [Entity](Entity.md)
- has a [PlatformKind](PlatformKind.md)
- built by [World](World.md) (as `PlatformKind.Ground`); passed to [Player](Player.md) as `solids`

## Members
| Member | Kind | Description |
|---|---|---|
| `new Platform(x, y, w, h, kind?)` | constructor | `kind` defaults to `PlatformKind.Platform` |
| `kind` | readonly property | How it is drawn |
| `draw(ctx)` | method | A filled block; the `Platform` kind also gets an outline |

## Example
```ts
const floor = new Platform(0, 40, 200, 20, PlatformKind.Ground);
player.update(1 / 60, { input, solids: [floor] });
```

## Design notes
A platform has no behaviour of its own — it only *is* a box. It inherits
`update` (do nothing) from [Entity](Entity.md) and only supplies `draw`.
The kind is an enum rather than a boolean so the two looks have names.
